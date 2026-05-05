import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CommonModule } from './common/common.module';
import { IamModule } from './iam/iam.module';
import { IxcModule } from './integrations/ixc/ixc.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';
import { CmdbModule } from './cmdb/cmdb.module';
import { ChangeModule } from './change-management/change.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnCallModule } from './on-call/on-call.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { CsatModule } from './csat/csat.module';
import { SlaPoliciesModule } from './sla-policies/sla-policies.module';
import { ReportsModule } from './reports/reports.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SecretsValidationService } from './config/secrets-validation.service';
import { ObservabilityInterceptor } from './monitoring/observability.interceptor';

@Module({
  imports: [
    PrismaModule, CommonModule, RealtimeModule, AuthModule, IamModule,
    ServiceOrdersModule, IxcModule, KnowledgeModule, CalendarModule, MonitoringModule,
    CmdbModule, ChangeModule, TimeTrackingModule, NotificationsModule,
    OnCallModule, ApiKeysModule, CsatModule, SlaPoliciesModule, ReportsModule,
    WorkflowsModule,
  ],
  controllers: [AppController],
  providers: [
    SecretsValidationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ObservabilityInterceptor,
    },
  ]
})
export class AppModule {}


