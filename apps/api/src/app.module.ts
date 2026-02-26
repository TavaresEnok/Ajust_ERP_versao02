import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { IamModule } from './iam/iam.module';
import { IxcModule } from './integrations/ixc/ixc.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';

@Module({
  imports: [PrismaModule, RealtimeModule, AuthModule, IamModule, ServiceOrdersModule, IxcModule, KnowledgeModule],
  controllers: [AppController]
})
export class AppModule {}
