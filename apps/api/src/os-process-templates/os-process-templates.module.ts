import { Module } from '@nestjs/common';
import { OsProcessTemplateController } from './os-process-templates.controller';
import { OsProcessTemplateService } from './os-process-templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [OsProcessTemplateController],
  providers: [OsProcessTemplateService],
  exports: [OsProcessTemplateService],
})
export class OsProcessTemplatesModule {}
