import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomersController } from './customers.controller';
@Module({ imports: [PrismaModule], controllers: [CustomersController] })
export class CustomersModule {}
