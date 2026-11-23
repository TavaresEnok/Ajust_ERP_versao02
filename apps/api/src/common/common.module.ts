import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';
import { GlobalRateLimitMiddleware } from './global-rate-limit.middleware';
import { RedisService } from './redis.service';
import { RequestContext } from './request-context';
import { TenantRateLimitGuard } from './tenant-rate-limit.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    AuditService,
    EmailService,
    GlobalRateLimitMiddleware,
    RedisService,
    RequestContext,
    TenantRateLimitGuard,
  ],
  exports: [
    AuditService,
    EmailService,
    GlobalRateLimitMiddleware,
    RedisService,
    RequestContext,
    TenantRateLimitGuard,
  ],
})
export class CommonModule {}
