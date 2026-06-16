import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { CsatModule } from '../csat/csat.module';
import { SlaModule } from '../sla/sla.module';
import { OsProcessTemplatesModule } from '../os-process-templates/os-process-templates.module';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';

@Module({
  imports: [AuthModule, CommonModule, CsatModule, SlaModule, OsProcessTemplatesModule],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
