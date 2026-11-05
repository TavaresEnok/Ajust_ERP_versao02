import { Module } from '@nestjs/common';
import { OnCallController } from './on-call.controller';
import { OnCallService } from './on-call.service';
import { TeamRosterService } from './team-roster.service';
import { TeamRosterController } from './team-roster.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OnCallController, TeamRosterController],
  providers: [OnCallService, TeamRosterService],
  exports: [OnCallService],
})
export class OnCallModule {}
