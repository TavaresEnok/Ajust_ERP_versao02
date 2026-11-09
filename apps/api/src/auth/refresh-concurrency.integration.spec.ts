import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { decryptSecret } from '../common/secrets.crypto';

const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Refresh retries across API replicas in PostgreSQL', () => {
  const db = new PrismaClient();
  const other = new PrismaClient();
  const sessionId = randomUUID();
  afterAll(async () => {
    await db.session.deleteMany({ where: { id: sessionId } });
    await db.$disconnect();
    await other.$disconnect();
  });

  it('shares one rotation and commits revocation for replays outside the grace period', async () => {
    const member = await db.userTenant.findFirstOrThrow({ where: { role: { code: 'gerente' } } });
    const token = sign(
      { sub: member.userId, sid: sessionId, jti: randomUUID(), typ: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '1h' },
    );
    await db.session.create({
      data: {
        id: sessionId,
        userId: member.userId,
        tenantId: member.tenantId,
        refreshTokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const service = (client: PrismaClient) =>
      new AuthService(client as never, {} as never, {} as never, {} as never, {} as never);
    const [a, b] = await Promise.all([
      service(db).refresh({ refreshToken: token }),
      service(other).refresh({ refreshToken: token }),
    ]);
    expect(a.refreshToken).toBe(b.refreshToken);
    const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.revokedAt).toBeNull();
    expect(session.refreshResponseEnc).toMatch(/^enc:v1:/);
    expect(JSON.parse(decryptSecret(session.refreshResponseEnc)).refreshToken).toBe(a.refreshToken);
    await db.session.update({
      where: { id: sessionId },
      data: { refreshResponseExpiresAt: new Date(0) },
    });
    await expect(service(other).refresh({ refreshToken: token })).rejects.toThrow('mismatch');
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: sessionId } })).revokedAt,
    ).not.toBeNull();
    await expect(service(db).refresh({ refreshToken: a.refreshToken })).rejects.toThrow('invalid');
  });
});
