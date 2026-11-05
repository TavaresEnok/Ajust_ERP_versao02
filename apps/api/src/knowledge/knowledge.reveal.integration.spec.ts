import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { KnowledgeService } from './knowledge.service';
jest.mock('../common/vault.crypto', () => ({ decryptVaultSecret: () => 'test-secret' }));
const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Concurrent vault reveals with real PostgreSQL', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());
  it('allows only one of two simultaneous reveals when one slot remains', async () => {
    const tenant = await prisma.tenant.findFirstOrThrow();
    const user = await prisma.user.create({
      data: {
        name: 'Vault test',
        email: `${randomUUID()}@example.invalid`,
        passwordHash: await hash('test-confirmation', 4),
      },
    });
    const oldLimit = process.env.VAULT_REVEALS_PER_HOUR;
    let credentialId: string | undefined;
    try {
      const credential = await prisma.knowledgeCredential.create({
        data: {
          tenantId: tenant.id,
          provider: 'CI',
          environment: 'CI',
          host: '',
          username: '',
          secretEnc: 'test',
        },
      });
      credentialId = credential.id;
      process.env.VAULT_REVEALS_PER_HOUR = '1';
      const service = new KnowledgeService(prisma as never, {} as never);
      const outcomes = await Promise.allSettled(
        [1, 2].map(() =>
          service.revealCredential(
            'analista',
            user.id,
            tenant.id,
            credential.id,
            'Teste concorrente',
            'test-confirmation',
          ),
        ),
      );
      if (outcomes.every((outcome) => outcome.status === 'rejected'))
        throw (outcomes[0] as PromiseRejectedResult).reason;
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const denied = outcomes.find(
        (outcome) => outcome.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(denied.reason.getStatus()).toBe(429);
      expect(
        await prisma.auditLog.count({
          where: { actorUserId: user.id, action: 'CREDENTIAL_ACCESS' },
        }),
      ).toBe(1);
    } finally {
      if (oldLimit === undefined) delete process.env.VAULT_REVEALS_PER_HOUR;
      else process.env.VAULT_REVEALS_PER_HOUR = oldLimit;
      await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
      if (credentialId) await prisma.knowledgeCredential.delete({ where: { id: credentialId } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
