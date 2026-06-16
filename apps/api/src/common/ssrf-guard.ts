import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';

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
  if (ip === '::1' || ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
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
 * Call this before any outbound HTTP request with user-supplied URLs.
 */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException(`Invalid URL: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException(`URL protocol not allowed: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // Block direct IP access to private ranges without DNS resolution
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new BadRequestException(`URL resolves to a private/internal address: ${hostname}`);
    }
    return;
  }

  // Block localhost variants
  if (['localhost', '0.0.0.0', '[::1]', '::1'].includes(hostname.toLowerCase())) {
    throw new BadRequestException(`URL points to a local address: ${hostname}`);
  }

  // DNS resolution check — prevent DNS rebinding
  try {
    const addresses = await lookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        throw new BadRequestException(
          `URL hostname ${hostname} resolves to a private/internal address (${address})`,
        );
      }
    }
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    // DNS lookup failure — block by default to be safe
    throw new BadRequestException(`Could not resolve hostname: ${hostname}`);
  }
}
