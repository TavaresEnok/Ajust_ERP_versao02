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
});
