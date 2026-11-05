import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NetworkTopologiesController } from './network-topologies.controller';
@Module({ imports: [PrismaModule], controllers: [NetworkTopologiesController] })
export class NetworkTopologiesModule {}
