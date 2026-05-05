import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService],
  exports: [SlaPoliciesService],
})
export class SlaPoliciesModule {}
