import { Module } from '@nestjs/common';
import { CsatController } from './csat.controller';
import { CsatService } from './csat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({ imports: [PrismaModule, CommonModule], controllers: [CsatController], providers: [CsatService], exports: [CsatService] })
export class CsatModule {}
