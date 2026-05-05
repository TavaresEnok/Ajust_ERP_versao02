import { Module } from '@nestjs/common';
import { CmdbController } from './cmdb.controller';
import { CmdbService } from './cmdb.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CmdbController],
  providers: [CmdbService],
})
export class CmdbModule {}
