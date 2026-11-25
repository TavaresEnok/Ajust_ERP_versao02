import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

// RFC 1918 private ranges + loopback + link-local + metadata endpoints
const BLOCKED_CIDRS: Array<{ start: bigint; end: bigint; label: string }> = [
  // Loopback
  cidr('127.0.0.0', 8, 'loopback'),
  // RFC 1918 private
  cidr('10.0.0.0', 8, 'private'),
  cidr('172.16.0.0', 12, 'private'),
  cidr('192.168.0.0', 16, 'private'),
  // Link-local (APIPA)
  cidr('169.254.0.0', 16, 'link-local'),
  // Cloud metadata endpoints
  cidr('100.64.0.0', 10, 'shared-address'),
  // IPv6 loopback resolved to IPv4
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

function isPrivateIpv4(ip: string): boolean {
  if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) return true;
  try {
    const n = ipToBigInt(ip);
    return BLOCKED_CIDRS.some((r) => n >= r.start && n <= r.end);
  } catch {
    return true;
  }
}

/** Expande um IPv6 (inclusive com sufixo IPv4) para 128 bits. */
function ipv6ToBigInt(ip: string): bigint | null {
  let address = ip.toLowerCase().split('%')[0];
  const v4 = address.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const n = ipToBigInt(v4[1]);
    address = `${address.slice(0, -v4[1].length)}${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  let n = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    n = (n << 16n) | BigInt(parseInt(group, 16));
  }
  return n;
}

function ipv6InPrefix(n: bigint, base: string, prefix: number): boolean {
  const start = ipv6ToBigInt(base);
  if (start === null) return false;
  const shift = BigInt(128 - prefix);
  return n >> shift === start >> shift;
}

function embeddedIpv4(n: bigint): string {
  const v4 = Number(n & 0xffffffffn);
  return [v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join('.');
}

/**
 * IPv6 público é permitido (hosts dual-stack publicam AAAA); bloqueia loopback, não
 * especificado, ULA, link-local, multicast, documentação e formatos que embutem um IPv4
 * (mapeado, NAT64, 6to4), que valem pelo IPv4 embutido.
 */
function isPrivateIpv6(ip: string): boolean {
  const n = ipv6ToBigInt(ip);
  if (n === null) return true;
  if (n === 0n || n === 1n) return true;
  if (ipv6InPrefix(n, '::ffff:0:0', 96) || ipv6InPrefix(n, '64:ff9b::', 96))
    return isPrivateIpv4(embeddedIpv4(n));
  if (ipv6InPrefix(n, '2002::', 16)) return isPrivateIpv4(embeddedIpv4(n >> 80n));
  if (ipv6InPrefix(n, '::', 96)) return true; // IPv4-compatível (obsoleto)
  return [
    ['fc00::', 7],
    ['fe80::', 10],
    ['fec0::', 10],
    ['ff00::', 8],
    ['100::', 64],
    ['2001:db8::', 32],
    ['2001::', 32], // Teredo
  ].some(([base, prefix]) => ipv6InPrefix(n, base as string, prefix as number));
}

function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

/**
 * Validates that a URL is safe to fetch (not pointing to internal networks).
 * Throws BadRequestException if the URL is private/internal.
 * Call this before any outbound HTTP request with user-supplied URLs.
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

  // Block direct IP access to private ranges without DNS resolution
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new BadRequestException(`URL resolves to a private/internal address: ${hostname}`);
    }
    return { address: hostname, family: 4 };
  }

  // Block localhost variants
  if (['localhost', '0.0.0.0', '[::1]', '::1'].includes(hostname.toLowerCase())) {
    throw new BadRequestException(`URL points to a local address: ${hostname}`);
  }

  // DNS resolution check — prevent DNS rebinding
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
    // Prefere IPv4: a rede Docker padrão não roteia IPv6.
    return addresses.find((entry) => entry.family === 4) ?? addresses[0];
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    // DNS lookup failure — block by default to be safe
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
