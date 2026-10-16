import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Priority, ServiceOrderType } from '@prisma/client';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole, assertManagerRole } from '../common/role-utils';
import { ServiceCatalogService, ServiceCatalogWriteInput } from './service-catalog.service';

const ServiceCatalogSchema = z.object({
  name: z.string().min(3).max(120),
  category: z.nativeEnum(ServiceOrderType).optional(),
  description: z.string().max(500).optional(),
  estimatedMinutes: z.number().int().min(5).max(1440).optional(),
  defaultPriority: z.nativeEnum(Priority).optional(),
  checklist: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

const ServiceCatalogUpdateSchema = ServiceCatalogSchema.partial();

@ApiTags('Catálogo de Serviços')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('service-catalog')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ServiceCatalogController {
  constructor(
    @Inject(ServiceCatalogService) private readonly serviceCatalog: ServiceCatalogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar serviços disponíveis no catálogo' })
  async list(
    @Req() req: RequestWithAuth,
    @Query('category') category?: ServiceOrderType,
    @Query('activeOnly') activeOnly?: string,
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'leitura', 'cliente']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.serviceCatalog.list(req.auth.tenantId, {
      category,
      activeOnly: activeOnly === undefined ? undefined : activeOnly === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar serviço por ID' })
  async getById(@Req() req: RequestWithAuth, @Param('id') id: string) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'leitura', 'cliente']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.serviceCatalog.getById(req.auth.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar novo serviço no catálogo' })
  async create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const parsed = ServiceCatalogSchema.parse(body) as ServiceCatalogWriteInput;
    return this.serviceCatalog.create(req.auth.tenantId, parsed);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar serviço do catálogo' })
  async update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const parsed = ServiceCatalogUpdateSchema.parse(body) as Partial<ServiceCatalogWriteInput>;
    return this.serviceCatalog.update(req.auth.tenantId, id, parsed);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover serviço do catálogo' })
  async remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.serviceCatalog.remove(req.auth.tenantId, id);
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Recriar catálogo padrão especializado para provedores' })
  async seedDefaults(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.serviceCatalog.seedDefaults(req.auth.tenantId);
  }
}
