import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { KnowledgeService } from './knowledge.service';

const ListArticlesSchema = z.object({
  search: z.string().trim().min(2).optional(),
  tag: z.string().trim().min(2).optional(),
  includeDrafts: z.coerce.boolean().optional()
});

const CreateArticleSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().min(3),
  content: z.string().min(3),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional()
});

const UpdateArticleSchema = z.object({
  title: z.string().min(3).optional(),
  content: z.string().min(3).optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional()
});

const CreateCredentialSchema = z.object({
  tenantId: z.string().uuid().optional(),
  provider: z.string().min(2),
  equipmentType: z.string().min(2).optional(),
  equipmentName: z.string().min(1).optional(),
  environment: z.string().min(2),
  host: z.string().min(2),
  username: z.string().min(2),
  secret: z.string().min(1),
  notes: z.string().optional()
});

const UpdateCredentialSchema = z.object({
  provider: z.string().min(2).optional(),
  equipmentType: z.string().min(2).optional(),
  equipmentName: z.string().optional(),
  environment: z.string().min(2).optional(),
  host: z.string().min(2).optional(),
  username: z.string().optional(),
  secret: z.string().min(1).optional(),
  notes: z.string().nullable().optional()
});

const ListCredentialsSchema = z.object({
  search: z.string().trim().min(2).optional(),
  provider: z.string().trim().min(2).optional(),
  equipmentType: z.string().trim().min(2).optional(),
  environment: z.string().trim().min(2).optional(),
  sortBy: z.enum(['provider', 'equipmentType', 'equipmentName', 'environment', 'host', 'username', 'notes', 'updatedAt', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const ListCredentialProvidersSchema = z.object({
  search: z.string().trim().min(2).optional(),
  equipmentType: z.string().trim().min(2).optional(),
  environment: z.string().trim().min(2).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const ListNotesSchema = z.object({
  search: z.string().trim().min(2).optional(),
  pinned: z.coerce.boolean().optional()
});

const CreateNoteSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  pinned: z.boolean().optional()
});

const UpdateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  pinned: z.boolean().optional()
}).refine((data) => data.title !== undefined || data.content !== undefined || data.pinned !== undefined, {
  message: 'At least one note field must be provided.'
});

@Controller('knowledge')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService) {}

  @Get('articles')
  async listArticles(
    @Req() req: RequestWithAuth,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('includeDrafts') includeDrafts?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListArticlesSchema.parse({ search, tag, includeDrafts });

    return this.knowledgeService.listArticles(req.auth.role || '', req.auth.userId, {
      tenantId: req.auth.tenantId,
      ...input
    });
  }

  @Post('articles')
  async createArticle(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = CreateArticleSchema.parse(body);

    return this.knowledgeService.createArticle(req.auth.role || '', req.auth.userId, {
      ...input,
      tenantId: req.auth.tenantId
    });
  }

  @Patch('articles/:id')
  async patchArticle(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const patch = UpdateArticleSchema.parse(body);
    return this.knowledgeService.updateArticle(req.auth.role || '', req.auth.userId, req.auth.tenantId, id, patch);
  }

  @Delete('articles/:id')
  async deleteArticle(
    @Req() req: RequestWithAuth,
    @Param('id') id: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.knowledgeService.deleteArticle(req.auth.role || '', req.auth.userId, req.auth.tenantId, id);
  }

  @Get('credentials')
  async listCredentials(
    @Req() req: RequestWithAuth,
    @Query('search') search?: string,
    @Query('provider') provider?: string,
    @Query('equipmentType') equipmentType?: string,
    @Query('environment') environment?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListCredentialsSchema.parse({ search, provider, equipmentType, environment, sortBy, sortDir, limit, offset });
    return this.knowledgeService.listCredentials(req.auth.role || '', req.auth.userId, {
      tenantId: req.auth.tenantId,
      ...input
    });
  }

  @Get('credentials/providers')
  async listCredentialProviders(
    @Req() req: RequestWithAuth,
    @Query('search') search?: string,
    @Query('equipmentType') equipmentType?: string,
    @Query('environment') environment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListCredentialProvidersSchema.parse({ search, equipmentType, environment, limit, offset });
    return this.knowledgeService.listCredentialProviders(req.auth.role || '', req.auth.userId, {
      tenantId: req.auth.tenantId,
      ...input
    });
  }

  @Post('credentials')
  async createCredential(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = CreateCredentialSchema.parse(body);

    return this.knowledgeService.createCredential(req.auth.role || '', req.auth.userId, {
      ...input,
      tenantId: req.auth.tenantId
    });
  }

  @Post('credentials/:id/reveal')
  async revealCredential(
    @Req() req: RequestWithAuth,
    @Param('id') id: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.knowledgeService.revealCredential(req.auth.role || '', req.auth.userId, req.auth.tenantId, id);
  }

  @Patch('credentials/:id')
  async patchCredential(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const patch = UpdateCredentialSchema.parse(body);
    return this.knowledgeService.updateCredential(req.auth.role || '', req.auth.userId, req.auth.tenantId, id, patch);
  }

  @Delete('credentials/:id')
  async deleteCredential(
    @Req() req: RequestWithAuth,
    @Param('id') id: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.knowledgeService.deleteCredential(req.auth.role || '', req.auth.userId, req.auth.tenantId, id);
  }

  @Get('notes')
  async listNotes(
    @Req() req: RequestWithAuth,
    @Query('search') search?: string,
    @Query('pinned') pinned?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListNotesSchema.parse({ search, pinned });
    return this.knowledgeService.listNotes(req.auth.role || '', req.auth.userId, {
      tenantId: req.auth.tenantId,
      ...input
    });
  }

  @Post('notes')
  async createNote(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = CreateNoteSchema.parse(body);

    return this.knowledgeService.createNote(req.auth.role || '', req.auth.userId, {
      ...input,
      tenantId: req.auth.tenantId
    });
  }

  @Patch('notes/:id')
  async patchNote(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const patch = UpdateNoteSchema.parse(body);
    return this.knowledgeService.updateNote(req.auth.role || '', req.auth.userId, req.auth.tenantId, id, patch);
  }

  @Delete('notes/:id')
  async deleteNote(
    @Req() req: RequestWithAuth,
    @Param('id') id: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.knowledgeService.deleteNote(req.auth.role || '', req.auth.userId, req.auth.tenantId, id);
  }
}
