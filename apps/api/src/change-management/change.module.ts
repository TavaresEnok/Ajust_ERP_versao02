import { Module } from '@nestjs/common';
import { ChangeController } from './change.controller';
import { ChangeService } from './change.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChangeController],
  providers: [ChangeService],
})
export class ChangeModule {}
