import { redisConnectionFromUrl } from './redis-connection';

describe('redisConnectionFromUrl', () => {
  it('mantém host e porta sem senha', () => {
    expect(redisConnectionFromUrl('redis://redis:6379')).toEqual({ host: 'redis', port: 6379 });
  });

  it('lê senha, usuário e banco', () => {
    expect(redisConnectionFromUrl('redis://worker:s%40nha@redis:6380/2')).toEqual({
      host: 'redis',
      port: 6380,
      username: 'worker',
      password: 's@nha',
      db: 2,
    });
  });

  it('lê só a senha (formato redis://:senha@host)', () => {
    expect(redisConnectionFromUrl('redis://:s3nha@redis:6379/0')).toEqual({
      host: 'redis',
      port: 6379,
      password: 's3nha',
      db: 0,
    });
  });

  it('ativa TLS em rediss://', () => {
    expect(redisConnectionFromUrl('rediss://cache.exemplo:6380')).toMatchObject({ tls: {} });
  });

  it('recusa protocolo desconhecido', () => {
    expect(() => redisConnectionFromUrl('http://redis:6379')).toThrow('protocolo inválido');
  });
});
