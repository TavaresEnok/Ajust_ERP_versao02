import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [IamController],
  providers: [IamService],
  exports: [IamService]
})
export class IamModule {}

