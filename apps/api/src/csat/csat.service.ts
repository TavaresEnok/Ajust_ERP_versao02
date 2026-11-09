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

  async createForOrder(tenantId: string, orderId: string, confirmDelivery = false) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: {
        id: true,
        protocol: true,
        status: true,
        occurrence: { select: { customer: { select: { contacts: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'FECHADA')
      throw new BadRequestException('A pesquisa só pode ser enviada após o fechamento da O.S.');
    // A pesquisa vai para o provedor atendido, não para o contato da Ajust (C-032).
    const contacts = (order.occurrence?.customer?.contacts ?? {}) as { emails?: unknown };
    const recipient = Array.isArray(contacts.emails)
      ? contacts.emails.find(
          (item): item is string => typeof item === 'string' && item.includes('@'),
        )
      : undefined;

    const existing = await this.prisma.satisfactionResponse.findFirst({
      where: { orderId, tenantId },
    });
    if (existing && (!confirmDelivery || existing.emailSentAt || existing.answered))
      return existing;

    const data = { tenantId, orderId, score: 1, answered: false };
    const survey =
      existing ??
      (confirmDelivery
        ? await this.prisma.satisfactionResponse.upsert({
            where: { orderId },
            create: data,
            update: {},
            include: { order: { select: { protocol: true } } },
          })
        : await this.prisma.satisfactionResponse.create({
            data,
            include: { order: { select: { protocol: true } } },
          }));
    const protocol = order.protocol;

    if (recipient) {
      const webBaseUrl =
        process.env.WEB_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8070';
      const link = `${webBaseUrl.replace(/\/+$/, '')}/csat/${survey.token}`;
      const send = confirmDelivery
        ? this.emailService.sendEmailConfirmed.bind(this.emailService)
        : this.emailService.sendEmail.bind(this.emailService);
      await send(
        recipient,
        `Pesquisa de Satisfação - O.S ${protocol || ''}`,
        `Olá!\n\nA Ordem de Serviço ${protocol || ''} foi resolvida. Gostaríamos de saber como foi sua experiência.\n\nPor favor, acesse o link abaixo para nos avaliar:\n${link}\n\nObrigado,\nEquipe Ajust ERP`,
        `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4f46e5;">Sua Ordem de Serviço foi concluída!</h2>
          <p>A O.S <strong>${protocol || ''}</strong> foi marcada como resolvida.</p>
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

    if (confirmDelivery && recipient)
      await this.prisma.satisfactionResponse.update({
        where: { id: survey.id },
        data: { emailSentAt: new Date() },
      });
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
