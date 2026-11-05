import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

// RFC 1918 private ranges + loopback + link-local + metadata endpoints
const BLOCKED_CIDRS: Array<{ start: bigint; end: bigint; label: string }> = [
  cidr('127.0.0.0', 8, 'loopback'),
  cidr('10.0.0.0', 8, 'private'),
  cidr('172.16.0.0', 12, 'private'),
  cidr('192.168.0.0', 16, 'private'),
  cidr('169.254.0.0', 16, 'link-local'),
  cidr('100.64.0.0', 10, 'shared-address'),
  cidr('0.0.0.0', 8, 'unspecified'),
  cidr('224.0.0.0', 4, 'multicast'),
  cidr('240.0.0.0', 4, 'reserved'),
  cidr('198.18.0.0', 15, 'benchmark'),
];

function ipToBigInt(ip: string): bigint {
  return ip.split('.').reduce((acc, octet) => (acc << 8n) | BigInt(parseInt(octet, 10)), 0n);
}

function cidr(base: string, prefix: number, label: string) {
  const start = ipToBigInt(base);
  const mask = ((1n << BigInt(prefix)) - 1n) << BigInt(32 - prefix);
  return { start: start & mask, end: (start & mask) | (~mask & 0xffffffffn), label };
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) !== 4) return true;
  if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) return true;
  try {
    const n = ipToBigInt(ip);
    return BLOCKED_CIDRS.some((r) => n >= r.start && n <= r.end);
  } catch {
    return true;
  }
}

/**
 * Validates that a URL is safe to fetch (not pointing to internal networks).
 * Throws BadRequestException if the URL is private/internal.
 */
async function resolveSafeUrl(rawUrl: string): Promise<{ address: string; family: number }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException(`Invalid URL: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException(`URL protocol not allowed: ${parsed.protocol}`);
  }

  if (parsed.username || parsed.password)
    throw new BadRequestException('Credenciais na URL não são permitidas.');
  const hostname = parsed.hostname;
  if (hostname.includes(':')) throw new BadRequestException('Endereços IPv6 não são permitidos.');

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new BadRequestException(`URL resolves to a private/internal address: ${hostname}`);
    }
    return { address: hostname, family: 4 };
  }

  if (['localhost', '0.0.0.0', '[::1]', '::1'].includes(hostname.toLowerCase())) {
    throw new BadRequestException(`URL points to a local address: ${hostname}`);
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length) throw new BadRequestException('Endereço sem resultado DNS.');
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        throw new BadRequestException(
          `URL hostname ${hostname} resolves to a private/internal address (${address})`,
        );
      }
    }
    return addresses[0];
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(`Could not resolve hostname: ${hostname}`);
  }
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  await resolveSafeUrl(rawUrl);
}

/** Resolve once and pin the connection. Native HTTP never follows redirects. */
export async function safeFetch(
  rawUrl: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    redirect?: 'manual';
  } = {},
): Promise<Response> {
  const destination = await resolveSafeUrl(rawUrl);
  const url = new URL(rawUrl);
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        method: init.method || 'GET',
        headers: init.headers,
        signal: init.signal,
        agent: false,
        // Preserve the hostname for Host and TLS certificate checks, but never resolve it again.
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [destination]);
          else callback(null, destination.address, destination.family);
        },
      },
      (response) => {
        const status = response.statusCode || 502;
        if (status >= 300 && status < 400) {
          response.resume();
          reject(new BadRequestException('Redirecionamento externo não permitido.'));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 10 * 1024 * 1024) {
            response.destroy(new Error('Resposta externa excede 10 MB.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (value !== undefined)
              headers.set(name, Array.isArray(value) ? value.join(', ') : value);
          }
          resolve(
            new Response(
              [204, 205, 304].includes(status) || init.method === 'HEAD'
                ? null
                : Buffer.concat(chunks),
              { status, headers },
            ),
          );
        });
      },
    );
    request.on('error', reject);
    request.setTimeout(10_000, () =>
      request.destroy(new Error('Tempo limite da conexão externa.')),
    );
    request.end(init.body);
  });
}
