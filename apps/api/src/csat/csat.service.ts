import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';

@Injectable()
export class CsatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async createForOrder(tenantId: string, orderId: string) {
    const existing = await (this.prisma as any).satisfactionResponse.findFirst({ where: { orderId } });
    if (existing) return existing;
    
    const survey = await (this.prisma as any).satisfactionResponse.create({
      data: { tenantId, orderId },
      include: {
        tenant: { select: { techContactEmail: true } },
        order: { select: { protocol: true } }
      }
    });

    if (survey.tenant?.techContactEmail) {
      const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/csat/${survey.token}`;
      await this.emailService.sendEmail(
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
        `
      );
    }

    return survey;
  }

  async answer(token: string, score: number, comment?: string) {
    const response = await (this.prisma as any).satisfactionResponse.findFirst({ where: { token } });
    if (!response) throw new NotFoundException('Survey not found.');
    if (response.answered) throw new BadRequestException('Survey already answered.');
    if (score < 1 || score > 5) throw new BadRequestException('Score must be between 1 and 5.');
    return (this.prisma as any).satisfactionResponse.update({
      where: { id: response.id },
      data: { score, comment, answered: true, answeredAt: new Date() },
    });
  }

  async getByToken(token: string) {
    const res = await (this.prisma as any).satisfactionResponse.findFirst({
      where: { token },
      include: { order: { select: { protocol: true, type: true } } },
    });
    if (!res) throw new NotFoundException('Survey not found.');
    return res;
  }

  async listByTenant(tenantId: string) {
    return (this.prisma as any).satisfactionResponse.findMany({
      where: { tenantId, answered: true },
      include: { order: { select: { id: true, protocol: true, type: true } } },
      orderBy: { answeredAt: 'desc' },
    });
  }

  async summary(tenantId: string) {
    const responses: any[] = await (this.prisma as any).satisfactionResponse.findMany({
      where: { tenantId, answered: true },
    });
    if (responses.length === 0) return { avg: 0, total: 0, distribution: {} };
    const avg = responses.reduce((s, r) => s + r.score, 0) / responses.length;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of responses) distribution[r.score]++;
    return { avg: Math.round(avg * 10) / 10, total: responses.length, distribution };
  }
}
