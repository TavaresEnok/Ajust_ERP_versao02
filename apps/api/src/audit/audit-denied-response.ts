import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../common/request-with-auth';

// Response middleware also sees denials raised by guards, before interceptors execute.
export async function auditDeniedResponse(
  prisma: PrismaService,
  req: RequestWithAuth,
  status: number,
) {
  if (![401, 403, 409, 429].includes(status)) return;
  const path = String(req.originalUrl || req.url).split('?')[0];
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: req.auth?.tenantId || null,
        actorUserId: req.auth?.userId || null,
        action: 'ACCESS_DENIED',
        resourceType: path.split('/').filter(Boolean)[0] || 'unknown',
        ip: req.ip || req.socket?.remoteAddress || 'unknown',
        metadata: { method: req.method, path, statusCode: status },
      },
    });
  } catch {
    console.error('[AUDIT] Não foi possível registrar acesso negado.');
  }
}
