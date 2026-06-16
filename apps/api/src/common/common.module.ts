import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';
import { RedisService } from './redis.service';
import { RequestContext } from './request-context';
import { TenantRateLimitGuard } from './tenant-rate-limit.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AuditService, EmailService, RedisService, RequestContext, TenantRateLimitGuard],
  exports: [AuditService, EmailService, RedisService, RequestContext, TenantRateLimitGuard],
})
export class CommonModule {}
