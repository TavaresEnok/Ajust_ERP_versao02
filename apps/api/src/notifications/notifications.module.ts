import { Module } from '@nestjs/common';
import { NotificationsController, WhatsAppNotificationController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [NotificationsController, WhatsAppNotificationController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

