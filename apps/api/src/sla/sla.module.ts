import { Module } from '@nestjs/common';
import { SlaEngineService } from './sla-engine.service';
import { SlaController } from './sla.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SlaController],
  providers: [SlaEngineService],
  exports: [SlaEngineService],
})
export class SlaModule {}
