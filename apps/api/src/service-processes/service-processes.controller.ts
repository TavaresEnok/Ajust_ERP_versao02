import {
  Body,
  GoneException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { ServiceProcessesService } from './service-processes.service';

@Controller('service-processes')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ServiceProcessesController {
  constructor(@Inject(ServiceProcessesService) private readonly service: ServiceProcessesService) {}
  private scope(req: RequestWithAuth) {
    this.service.assertRole(req.auth!.role || '');
    return { tenantId: req.auth!.tenantId!, actorId: req.auth!.userId, role: req.auth!.role || '' };
  }
  @Get('templates')
  templates(@Req() req: RequestWithAuth) {
    return this.service.templates(this.scope(req).tenantId);
  }
  @Get('assignees')
  assignees(@Req() req: RequestWithAuth) {
    return this.service.assignees(this.scope(req).tenantId);
  }
  @Put('templates')
  save(@Req() req: RequestWithAuth, @Body() _body: unknown) {
    this.scope(req);
    throw new GoneException(
      'Processos antigos estão disponíveis apenas para consulta. Use os processos operacionais.',
    );
  }
  @Get()
  list(@Req() req: RequestWithAuth) {
    return this.service.list(this.scope(req).tenantId);
  }
  @Get(':id')
  find(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.find(this.scope(req).tenantId, id);
  }
  @Post()
  start(@Req() req: RequestWithAuth, @Body() _body: unknown) {
    this.scope(req);
    throw new GoneException(
      'Processos antigos estão disponíveis apenas para consulta. Use os processos operacionais.',
    );
  }
  @Post(':id/actions')
  act(@Req() req: RequestWithAuth, @Param('id') _id: string, @Body() _body: unknown) {
    this.scope(req);
    throw new GoneException(
      'Processos antigos estão disponíveis apenas para consulta. Use os processos operacionais.',
    );
  }
}
