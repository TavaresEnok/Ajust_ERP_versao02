import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { IxcController } from './ixc.controller';
import { IxcService } from './ixc.service';
import { SlaModule } from '../../sla/sla.module';

@Module({
  imports: [AuthModule, SlaModule],
  controllers: [IxcController],
  providers: [IxcService],
  exports: [IxcService],
})
export class IxcModule {}
