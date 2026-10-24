import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceProcessesController } from './service-processes.controller';
import { ServiceProcessesService } from './service-processes.service';
import { OperationalProcessesController } from './operational-processes.controller';
import { OperationalProcessesService } from './operational-processes.service';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [PrismaModule, WorkflowsModule],
  controllers: [OperationalProcessesController, ServiceProcessesController],
  providers: [ServiceProcessesService, OperationalProcessesService],
  exports: [ServiceProcessesService, OperationalProcessesService],
})
export class ServiceProcessesModule {}
