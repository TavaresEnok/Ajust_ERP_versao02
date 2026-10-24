import {
  Controller,
  Get,
  Inject,
  Module,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { assertAnyRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Controller('customers')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class CustomersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private scope(req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return { tenantId: req.auth!.tenantId!, deletedAt: null };
  }

  @Get()
  list(@Req() req: RequestWithAuth) {
    return this.prisma.customer.findMany({ where: this.scope(req), orderBy: { tradeName: 'asc' } });
  }

  @Get(':id')
  async find(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const scope = this.scope(req);
    const customer = await this.prisma.customer.findFirst({
      where: { ...scope, id },
      include: {
        occurrences: {
          where: scope,
          orderBy: { createdAt: 'desc' },
          include: {
            serviceOrders: {
              where: {
                ...scope,
              },
              select: {
                id: true,
                protocol: true,
                title: true,
                status: true,
                analystName: true,
                createdAt: true,
                processInstanceId: true,
              },
            },
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado neste workspace.');
    return customer;
  }
}

@Module({ imports: [PrismaModule], controllers: [CustomersController] })
export class CustomersModule {}
