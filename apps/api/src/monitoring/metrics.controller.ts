import { Controller, Get, Inject, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusService } from './prometheus.service';

@Controller('monitoring')
export class MetricsController {
  constructor(
    @Inject(PrometheusService)
    private readonly prometheusService: PrometheusService
  ) {}

  @Get('/metrics')
  async metrics(@Res() res: Response): Promise<void> {
    const metrics = this.prometheusService.getMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  }

  @Get('/health')
  health(): { status: string; timestamp: string; environment: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('/ready')
  ready(): { ready: boolean; timestamp: string } {
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  }
}
