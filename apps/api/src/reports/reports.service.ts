import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getOperationalHealth(tenantId: string) {
    const orders = await (this.prisma as any).serviceOrder.findMany({
      where: { tenantId },
      include: { timeEntries: true },
    });

    const providersData = new Map<string, any>();

    for (const rawOrder of orders) {
      const order = rawOrder as any;
      const p = order.requester || 'Interno';
      if (!providersData.has(p)) {
        providersData.set(p, { name: p, totalOrders: 0, criticalOrders: 0, closedOrders: 0, totalMinutes: 0 });
      }
      
      const pData = providersData.get(p);
      pData.totalOrders += 1;
      if (['Critica', 'CRITICA'].includes(order.priority)) pData.criticalOrders += 1;
      if (['Fechada', 'Resolvida', 'FECHADA', 'RESOLVIDA'].includes(order.status)) pData.closedOrders += 1;
      
      const orderMinutes = order.timeEntries?.reduce((sum: number, t: any) => sum + t.minutes, 0) || 0;
      pData.totalMinutes += orderMinutes;
    }

    const report = Array.from(providersData.values()).map(p => {
      const criticalRate = p.totalOrders > 0 ? (p.criticalOrders / p.totalOrders) : 0;
      const resolutionRate = p.totalOrders > 0 ? (p.closedOrders / p.totalOrders) : 0;
      const hoursConsumed = Math.round((p.totalMinutes / 60) * 10) / 10;
      
      // Calculate Grade A-F based on critical rate and resolution rate
      // Low critical rate + high resolution = A
      let score = 100;
      score -= (criticalRate * 100); // penalty for criticals
      score -= ((1 - resolutionRate) * 50); // penalty for unresolved
      
      let grade = 'A';
      if (score < 50) grade = 'F';
      else if (score < 65) grade = 'D';
      else if (score < 80) grade = 'C';
      else if (score < 90) grade = 'B';

      return {
        ...p,
        criticalRate: Math.round(criticalRate * 100),
        resolutionRate: Math.round(resolutionRate * 100),
        hoursConsumed,
        score: Math.round(score),
        grade
      };
    });

    // Sort by grade worst to best, then by volume
    return report.sort((a, b) => a.score - b.score);
  }
}
