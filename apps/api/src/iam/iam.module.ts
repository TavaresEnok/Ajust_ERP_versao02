import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, CommonModule, RealtimeModule],
  controllers: [IamController],
  providers: [IamService],
  exports: [IamService],
})
export class IamModule {}
