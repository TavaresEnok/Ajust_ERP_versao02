import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { IxcReconciliationService } from './integrations/ixc-reconciliation.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExportRetentionService } from './reports/export-retention.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [IxcReconciliationService, ExportRetentionService]
})
export class AppModule {}
