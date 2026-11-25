import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { assertSafeUrl } from './ssrf-guard';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

describe('assertSafeUrl', () => {
  const mockedLookup = lookup as jest.Mock;

  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it.each(['not-a-url', 'ftp://example.com/file'])('rejects invalid URL %s', async (url) => {
    await expect(assertSafeUrl(url)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['http://127.0.0.1', 'http://10.0.0.1', 'http://localhost'])(
    'rejects direct private/local URL %s',
    async (url) => {
      await expect(assertSafeUrl(url)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('allows public direct IP', async () => {
    await expect(assertSafeUrl('https://8.8.8.8/path')).resolves.toBeUndefined();
  });

  it('allows hostname resolving only to public IPs', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    await expect(assertSafeUrl('https://public.example/path')).resolves.toBeUndefined();
  });

  it('rejects hostname resolving to private IP or failing DNS', async () => {
    mockedLookup.mockResolvedValueOnce([{ address: '192.168.1.2', family: 4 }]);
    await expect(assertSafeUrl('https://private.example')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    mockedLookup.mockRejectedValueOnce(new Error('dns failed'));
    await expect(assertSafeUrl('https://missing.example')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows dual-stack hostnames whose IPv6 is public', async () => {
    mockedLookup.mockResolvedValue([
      { address: '2606:4700::6810:84e5', family: 6 },
      { address: '104.16.132.229', family: 4 },
    ]);
    await expect(assertSafeUrl('https://api.cloudflare.example')).resolves.toBeUndefined();
  });

  it.each([
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.5',
    '64:ff9b::a00:1',
    '2002:c0a8:101::1',
    '2001:db8::1',
  ])('rejects hostname resolving to non-public IPv6 %s', async (address) => {
    mockedLookup.mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address, family: 6 },
    ]);
    await expect(assertSafeUrl('https://mixed.example')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
