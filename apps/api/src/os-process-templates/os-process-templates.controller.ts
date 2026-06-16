import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Priority, ServiceOrderType } from '@prisma/client';
import { OsProcessTemplateService } from './os-process-templates.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertManagerRole } from '../common/role-utils';

const OS_TYPES = Object.values(ServiceOrderType) as [string, ...string[]];
const PRIORITIES = Object.values(Priority) as [string, ...string[]];

const ChildOrderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(OS_TYPES),
  priority: z.enum(PRIORITIES),
  sector: z.string().optional(),
  origin: z.string().optional(),
  description: z.string().optional(),
  deadlineHours: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
});

const DefinitionSchema = z.object({
  childOrders: z.array(ChildOrderSchema).min(1),
});

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  triggerOsTypes: z.array(z.enum(OS_TYPES)).min(1),
  definition: DefinitionSchema,
});

const UpdateSchema = CreateSchema.partial();

@ApiTags('Templates de OS')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Sem permissão' })
@UseGuards(AuthGuard, TenantIsolationGuard)
@Controller('os-process-templates')
export class OsProcessTemplateController {
  constructor(
    @Inject(OsProcessTemplateService) private readonly service: OsProcessTemplateService,
  ) {}

  private tid(req: RequestWithAuth): string {
    return req.auth!.tenantId!;
  }
  private uid(req: RequestWithAuth): string {
    return req.auth!.userId;
  }

  @ApiOperation({ summary: 'Listar templates de OS do tenant' })
  @Get()
  list(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    return this.service.list(this.tid(req));
  }

  @ApiOperation({ summary: 'Buscar template por ID' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Get(':id')
  findOne(@Req() req: RequestWithAuth, @Param('id') id: string) {
    assertManagerRole(req.auth);
    return this.service.findOne(this.tid(req), id);
  }

  @ApiOperation({ summary: 'Criar template de OS' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    assertManagerRole(req.auth);
    const data = CreateSchema.parse(body);
    return this.service.create(this.tid(req), this.uid(req), data as any);
  }

  @ApiOperation({ summary: 'Atualizar template de OS' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    assertManagerRole(req.auth);
    const data = UpdateSchema.parse(body);
    return this.service.update(this.tid(req), this.uid(req), id, data as any);
  }

  @ApiOperation({ summary: 'Remover template de OS' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    assertManagerRole(req.auth);
    return this.service.remove(this.tid(req), this.uid(req), id);
  }

  @ApiOperation({ summary: 'Ativar/desativar template' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Patch(':id/toggle')
  toggle(@Req() req: RequestWithAuth, @Param('id') id: string) {
    assertManagerRole(req.auth);
    return this.service.toggle(this.tid(req), this.uid(req), id);
  }
}
