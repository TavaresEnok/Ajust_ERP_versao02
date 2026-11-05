import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerPortalController } from './customer-portal.controller';
@Module({ imports: [PrismaModule], controllers: [CustomerPortalController] })
export class CustomerPortalModule {}
