import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ShiftReportsController } from './shift-reports.controller';
@Module({ imports: [PrismaModule], controllers: [ShiftReportsController] })
export class ShiftReportsModule {}
