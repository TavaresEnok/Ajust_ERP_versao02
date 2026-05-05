import { Module } from '@nestjs/common';
import { OnCallController } from './on-call.controller';
import { OnCallService } from './on-call.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [OnCallController], providers: [OnCallService], exports: [OnCallService] })
export class OnCallModule {}
