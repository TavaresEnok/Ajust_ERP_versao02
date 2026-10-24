import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { CsatModule } from '../csat/csat.module';
import { SlaModule } from '../sla/sla.module';
import { OsProcessTemplatesModule } from '../os-process-templates/os-process-templates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceProcessesModule } from '../service-processes/service-processes.module';
import { OrderOperationsService } from './order-operations.service';
import { OrderOperationsController } from './order-operations.controller';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    CsatModule,
    SlaModule,
    OsProcessTemplatesModule,
    NotificationsModule,
    ServiceProcessesModule,
  ],
  controllers: [OrderOperationsController, ServiceOrdersController],
  providers: [ServiceOrdersService, OrderOperationsService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}

