import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowActionExecutor } from './action-executor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CsatModule } from '../csat/csat.module';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [PrismaModule, CommonModule, NotificationsModule, CsatModule, SlaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowActionExecutor],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
