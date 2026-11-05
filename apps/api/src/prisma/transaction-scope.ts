import type { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

/** Reuse the caller's transaction for services that compose several database operations. */
export function transactionScope(tx: Prisma.TransactionClient): PrismaService {
  return new Proxy(tx, {
    get(target, key) {
      if (key === '$transaction')
        return (callback: (client: Prisma.TransactionClient) => unknown) => callback(tx);
      return Reflect.get(target, key);
    },
  }) as PrismaService;
}
