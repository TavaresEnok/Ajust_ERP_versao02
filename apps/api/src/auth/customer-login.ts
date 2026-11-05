import { PrismaService } from '../prisma/prisma.service';

/** Resolve a document through the customer registry; never choose an arbitrary portal user. */
export async function resolveCustomerLogin(
  prisma: PrismaService,
  document: string,
  email?: string,
  tenantId?: string,
) {
  const digits = document.replace(/\D/g, '');
  if (!/^\d{14}$/.test(digits)) return null;
  const formatted = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  const candidates = await prisma.userTenant.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      role: { code: 'cliente' },
      tenant: { status: 'ACTIVE', deletedAt: null },
      user: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(email ? { email: email.trim().toLowerCase() } : {}),
      },
      customer: { deletedAt: null, taxId: { in: [digits, formatted] } },
    },
    include: {
      customer: true,
      user: { include: { tenants: { include: { role: true, tenant: true } } } },
    },
    take: 2,
  });
  if (candidates.length !== 1) return null;
  const match = candidates[0];
  return match.customer?.tenantId === match.tenantId ? match : null;
}
