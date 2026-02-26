import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';

@Module({
  imports: [AuthModule],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
  exports: [ServiceOrdersService]
})
export class ServiceOrdersModule {}
