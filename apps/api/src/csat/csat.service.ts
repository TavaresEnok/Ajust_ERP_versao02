import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SatisfactionResponse } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';

@Injectable()
export class CsatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
  ) {}

  async createForOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const existing = await this.prisma.satisfactionResponse.findFirst({
      where: { orderId, tenantId },
    });
    if (existing) return existing;

    const survey = await this.prisma.satisfactionResponse.create({
      data: { tenantId, orderId, score: 1, answered: false },
      include: {
        tenant: { select: { techContactEmail: true } },
        order: { select: { protocol: true } },
      },
    });

    if (survey.tenant?.techContactEmail) {
      const webBaseUrl =
        process.env.WEB_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8070';
      const link = `${webBaseUrl.replace(/\/+$/, '')}/csat/${survey.token}`;
      this.emailService.sendEmail(
        survey.tenant.techContactEmail,
        `Pesquisa de Satisfação - O.S ${survey.order?.protocol || ''}`,
        `Olá!\n\nA Ordem de Serviço ${survey.order?.protocol || ''} foi resolvida. Gostaríamos de saber como foi sua experiência.\n\nPor favor, acesse o link abaixo para nos avaliar:\n${link}\n\nObrigado,\nEquipe Ajust ERP`,
        `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4f46e5;">Sua Ordem de Serviço foi concluída!</h2>
          <p>A O.S <strong>${survey.order?.protocol || ''}</strong> foi marcada como resolvida.</p>
          <p>Para continuarmos entregando o melhor serviço, sua opinião é fundamental. Demora menos de 10 segundos!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #6366f1; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Avaliar Atendimento
            </a>
          </div>
          <p style="font-size: 12px; color: #777;">Se o botão não funcionar, copie e cole o link no seu navegador: <br/>${link}</p>
        </div>
        `,
      );
    }

    return survey;
  }

  async answer(token: string, score: number, comment?: string) {
    if (score < 1 || score > 5) throw new BadRequestException('Score must be between 1 and 5.');

    const result = await this.prisma.satisfactionResponse.updateMany({
      where: { token, answered: false },
      data: { score, comment, answered: true, answeredAt: new Date() },
    });
    if (result.count > 0) return { success: true };

    const existing = await this.prisma.satisfactionResponse.findFirst({
      where: { token },
      select: { answered: true },
    });
    if (!existing) throw new NotFoundException('Survey not found.');
    throw new BadRequestException('Survey already answered.');
  }

  async getByToken(token: string) {
    const res = await this.prisma.satisfactionResponse.findFirst({
      where: { token },
      select: {
        answered: true,
        order: { select: { protocol: true, type: true } },
      },
    });
    if (!res) throw new NotFoundException('Survey not found.');
    return res;
  }

  async listByTenant(tenantId: string) {
    return this.prisma.satisfactionResponse.findMany({
      where: { tenantId, answered: true },
      include: { order: { select: { id: true, protocol: true, type: true } } },
      orderBy: { answeredAt: 'desc' },
    });
  }

  async summary(tenantId: string) {
    const responses: SatisfactionResponse[] = await this.prisma.satisfactionResponse.findMany({
      where: { tenantId, answered: true },
    });
    if (responses.length === 0) return { avg: 0, total: 0, distribution: {} };
    const avg = responses.reduce((s, r) => s + r.score, 0) / responses.length;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of responses) distribution[r.score]++;
    return { avg: Math.round(avg * 10) / 10, total: responses.length, distribution };
  }
}
