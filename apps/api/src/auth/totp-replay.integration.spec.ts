import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { encryptSecret } from '../common/secrets.crypto';
const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('TOTP replay in PostgreSQL', () => {
  const prisma = new PrismaClient();
  const ids: string[] = [];
  const saved = { ...process.env };
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-only-32-characters-minimum';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-only-32-characters-minimum';
    process.env.SECRETS_ENCRYPTION_KEY = 'test-encryption-only-32-characters-minimum';
  });
  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SECRETS_ENCRYPTION_KEY']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  it('allows only one simultaneous verification and rejects reuse across pending sessions', async () => {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    const role = await prisma.role.findFirstOrThrow({ where: { code: 'gerente' } });
    const totp = new TotpService();
    const secret = totp.generateSecret();
    const id = randomUUID();
    ids.push(id);
    const email = `totp-${id}@test.local`;
    await prisma.user.create({
      data: {
        id,
        name: 'TOTP test',
        email,
        passwordHash: await hash('test-password', 4),
        status: 'ACTIVE',
        twoFactorEnabled: true,
        twoFactorSecretEnc: encryptSecret(secret),
        tenants: { create: { tenantId: tenant.id, roleId: role.id } },
      },
    });
    const service = new AuthService(
      prisma as never,
      { log: async () => {} } as never,
      {} as never,
      totp,
      {} as never,
    );
    const login = await service.login({ identifier: email, password: 'test-password' });
    if (!('temporaryToken' in login)) throw new Error('Expected 2FA challenge');
    const code = totp.getCurrentCode(secret);
    const results = await Promise.allSettled([
      service.verify2FA(login.temporaryToken!, code),
      service.verify2FA(login.temporaryToken!, code),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    const again = await service.login({ identifier: email, password: 'test-password' });
    if (!('temporaryToken' in again)) throw new Error('Expected 2FA challenge');
    await expect(service.verify2FA(again.temporaryToken!, code)).rejects.toThrow();
    expect(await prisma.session.count({ where: { userId: id } })).toBe(2); // One full session, one unused challenge.
  });
});
