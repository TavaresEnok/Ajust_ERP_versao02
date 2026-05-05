import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Health check endpoint
   * Usado por Kubernetes para validar se a aplicação está viva e pronta
   * 
   * GET /health → 200 OK se tudo está funcionando
   * GET /health → 503 Service Unavailable se dependências críticas estão down
   */
  @Get('health')
  async health() {
    const startTime = Date.now();
    const checks: Record<string, any> = {
      api: { status: 'healthy' },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    // Verificar conexão com banco de dados
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', responseTime: `${Date.now() - startTime}ms` };
    } catch (error) {
      checks.database = { status: 'unhealthy', error: (error as Error).message };
    }

    // Determinar status geral
    const allHealthy = Object.values(checks)
      .filter(v => typeof v === 'object' && v !== null && 'status' in v)
      .every(v => v.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      responseTime: `${Date.now() - startTime}ms`
    };
  }

  /**
   * Ready check endpoint
   * Usado por Kubernetes em readiness probes
   * Retorna 503 enquanto dependências críticas não estão prontas
   * 
   * GET /ready → 200 OK quando pronto para receber tráfego
   */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ready: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        ready: false,
        error: 'Database not ready',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Live check endpoint
   * Usado por Kubernetes em liveness probes
   * Simples verificação que a aplicação ainda está rodando
   * 
   * GET /live → 200 OK se o processo ainda está vivo
   */
  @Get('live')
  async live() {
    return {
      alive: true,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}
