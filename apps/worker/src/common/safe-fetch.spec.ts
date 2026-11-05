import { EventEmitter } from 'node:events';
import { lookup } from 'dns/promises';
import { request } from 'node:https';
import { safeFetch, assertSafeUrl } from './ssrf-guard';
jest.mock('dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

describe('Outbound connection protection', () => {
  beforeEach(() => jest.resetAllMocks());
  it.each([
    'http://[::1]',
    'http://[fc00::1]',
    'http://[fe80::1]',
    'http://[::ffff:7f00:1]',
    'http://224.0.0.1',
    'http://240.0.0.1',
    'http://user:password@example.com',
  ])('blocks %s', async (url) => {
    await expect(assertSafeUrl(url)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('rejects an empty or mixed public/private DNS answer', async () => {
    (lookup as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(safeFetch('https://example.com')).rejects.toThrow();
    await expect(safeFetch('https://example.com')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([200, 302])('pins DNS and never follows redirects (status %s)', async (status) => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const response = Object.assign(new EventEmitter(), {
      statusCode: status,
      headers: { location: 'http://127.0.0.1' },
      resume: jest.fn(),
    });
    (request as jest.Mock).mockImplementation((url, options, callback) => {
      expect(url.hostname).toBe('example.com');
      const resolved = jest.fn();
      options.lookup('example.com', {}, resolved);
      expect(resolved).toHaveBeenCalledWith(null, '8.8.8.8', 4);
      options.lookup('example.com', { all: true }, resolved);
      expect(resolved).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }]);
      return Object.assign(new EventEmitter(), {
        setTimeout: jest.fn(),
        end: () => {
          callback(response);
          response.emit('data', Buffer.from('ok'));
          response.emit('end');
        },
      });
    });
    if (status === 200) expect(await (await safeFetch('https://example.com')).text()).toBe('ok');
    else await expect(safeFetch('https://example.com')).rejects.toThrow('Redirecionamento');
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
