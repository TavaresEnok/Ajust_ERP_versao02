import type { ConnectionOptions } from 'bullmq';

/**
 * Converte `REDIS_URL` nas opções de conexão do BullMQ, preservando usuário, senha,
 * número do banco e TLS (`rediss://`). Ex.: `redis://:senha@redis:6379/0`.
 */
export function redisConnectionFromUrl(
  raw: string = process.env.REDIS_URL || 'redis://redis:6379',
): ConnectionOptions {
  const url = new URL(raw);
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error(`REDIS_URL com protocolo inválido: ${url.protocol}`);
  }
  const db = url.pathname.replace(/^\//, '');
  return {
    host: url.hostname || 'redis',
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(db ? { db: Number(db) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export const redisConnection = redisConnectionFromUrl();
