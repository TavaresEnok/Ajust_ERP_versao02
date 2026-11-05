import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import {
  Body,
  GoneException,
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
import { OsProcessTemplateService } from './os-process-templates.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertManagerRole } from '../common/role-utils';

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
  create(@Req() req: RequestWithAuth, @Body() _body: unknown) {
    assertManagerRole(req.auth);
    throw new GoneException(
      'Modelos antigos estão disponíveis apenas para consulta. Configure as etapas nos processos operacionais.',
    );
  }

  @ApiOperation({ summary: 'Atualizar template de OS' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') _id: string, @Body() _body: unknown) {
    assertManagerRole(req.auth);
    throw new GoneException(
      'Modelos antigos estão disponíveis apenas para consulta. Configure as etapas nos processos operacionais.',
    );
  }

  @ApiOperation({ summary: 'Remover template de OS' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') _id: string) {
    assertManagerRole(req.auth);
    throw new GoneException(
      'Modelos antigos estão disponíveis apenas para consulta. Configure as etapas nos processos operacionais.',
    );
  }

  @ApiOperation({ summary: 'Ativar/desativar template' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @Patch(':id/toggle')
  toggle(@Req() req: RequestWithAuth, @Param('id') _id: string) {
    assertManagerRole(req.auth);
    throw new GoneException(
      'Modelos antigos estão disponíveis apenas para consulta. Configure as etapas nos processos operacionais.',
    );
  }
}
