import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

@Injectable()
export class MonthlyHealthReportService implements OnModuleInit {
  private readonly logger = new Logger(MonthlyHealthReportService.name);
  private running = false;
  private transporter?: Transporter;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!process.env.SMTP_HOST) {
      this.logger.warn('SMTP is not configured. Monthly reports will not be marked as sent.');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      // Sem timeouts um SMTP travado prende o worker indefinidamente.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async runCheck() {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      // Only run on the 1st of the month
      if (now.getDate() !== 1) return;

      const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`; // e.g. "2026-4"

      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true, legalName: true, techContactEmail: true },
      });

      for (const tenant of tenants) {
        if (!tenant.techContactEmail) continue;

        // Check if we already sent for this tenant this month
        const logKey = `health_report_${currentMonth}`;
        const existingLog = await this.prisma.auditLog.findFirst({
          where: { tenantId: tenant.id, action: 'EXPORT', resourceType: logKey },
        });

        if (existingLog) continue; // Already sent

        // Um tenant com erro (SMTP, e-mail inválido) não pode impedir o envio aos demais.
        try {
          await this.generateAndSendReport(tenant);

          await this.prisma.auditLog.create({
            data: {
              tenantId: tenant.id,
              actorUserId: null,
              action: 'EXPORT',
              resourceType: logKey,
              resourceId: currentMonth,
              metadata: { type: 'monthly_health_report_email' },
            },
          });
        } catch (error) {
          this.logger.error(
            `Monthly health report failed for tenant ${tenant.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async generateAndSendReport(tenant: {
    id: string;
    legalName: string;
    techContactEmail: string;
  }) {
    // Basic aggregation for last month's orders
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Contagens no banco (antes carregava todas as O.S. do mês no worker de 512 MB).
    // Mesmas regras do relatório da API: sem excluídas, sem demonstração, crítica = CRITICA.
    const [counts] = await this.prisma.$queryRaw<
      { total: number; closed: number; critical: number }[]
    >`
      SELECT
        COUNT(*)::int AS total,
        (COUNT(*) FILTER (WHERE "status" IN ('FECHADA', 'RESOLVIDA')))::int AS closed,
        (COUNT(*) FILTER (WHERE "priority" = 'CRITICA'))::int AS critical
      FROM "ServiceOrder"
      WHERE "tenantId" = ${tenant.id}
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${firstDayLastMonth} AND "createdAt" <= ${lastDayLastMonth}
        AND ("sourceMetadata"->'demonstration') IS DISTINCT FROM 'true'::jsonb
    `;
    const { total = 0, closed = 0, critical = 0 } = counts ?? {};

    const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 100;

    // Grade calculation (simplified logic matching API reports)
    let score = 100;
    if (total > 0) {
      score -= (critical / total) * 100;
      score -= (1 - closed / total) * 50;
    }
    const finalScore = Math.max(0, Math.round(score));
    let grade = 'A';
    if (finalScore < 50) grade = 'F';
    else if (finalScore < 65) grade = 'D';
    else if (finalScore < 80) grade = 'C';
    else if (finalScore < 90) grade = 'B';

    const monthName = firstDayLastMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const html = `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2>Ajust ERP</h2>
          <p>Relatório de Saúde Operacional - ${monthName}</p>
        </div>
        <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 0 0 8px 8px;">
          <p>Olá equipe da <strong>${escapeHtml(tenant.legalName)}</strong>,</p>
          <p>Aqui está o resumo da sua saúde operacional no último mês.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-between; align-items: center;">
            <div style="text-align: center; flex: 1;">
              <p style="font-size: 12px; color: #64748b; margin: 0;">Nota de Saúde (Health Score)</p>
              <p style="font-size: 36px; font-weight: bold; color: ${grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : '#ef4444'}; margin: 10px 0;">
                ${grade}
              </p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Total de O.S abertas:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${total}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">O.S Críticas:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${critical}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Taxa de Resolução:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${resolutionRate}%</td>
            </tr>
          </table>

          <p style="font-size: 14px; color: #64748b;">Este é um e-mail automático gerado pelo seu painel Ajust ERP.</p>
        </div>
      </div>
    `;

    if (!this.transporter) {
      throw new Error('SMTP is not configured for monthly health reports.');
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || '"Ajust ERP" <noreply@ajusterp.com.br>',
      to: tenant.techContactEmail,
      subject: `Saúde Operacional - ${monthName} (${grade})`,
      html,
    });
    this.logger.log(`Sent health report email to ${tenant.techContactEmail}`);
  }
}
