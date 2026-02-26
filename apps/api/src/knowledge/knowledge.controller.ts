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
  UseGuards
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
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
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService) {}

  @Get('articles')
  async listArticles(
    @Req() req: RequestWithAuth,
    @Query('tenantId') tenantIdParam?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('includeDrafts') includeDrafts?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for listing articles.');
    }

    const input = ListArticlesSchema.parse({ search, tag, includeDrafts });

    return this.knowledgeService.listArticles(req.auth!.role || '', req.auth!.userId, {
      tenantId,
      ...input
    });
  }

  @Post('articles')
  async createArticle(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const input = CreateArticleSchema.parse(body);
    const tenantId = input.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for creating article.');
    }

    return this.knowledgeService.createArticle(req.auth!.role || '', req.auth!.userId, {
      ...input,
      tenantId
    });
  }

  @Patch('articles/:id')
  async patchArticle(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query('tenantId') tenantIdParam?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for updating article.');
    }

    const patch = UpdateArticleSchema.parse(body);
    return this.knowledgeService.updateArticle(req.auth!.role || '', req.auth!.userId, tenantId, id, patch);
  }

  @Delete('articles/:id')
  async deleteArticle(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Query('tenantId') tenantIdParam?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for deleting article.');
    }

    return this.knowledgeService.deleteArticle(req.auth!.role || '', req.auth!.userId, tenantId, id);
  }

  @Get('credentials')
  async listCredentials(
    @Req() req: RequestWithAuth,
    @Query('tenantId') tenantIdParam?: string,
    @Query('search') search?: string,
    @Query('provider') provider?: string,
    @Query('equipmentType') equipmentType?: string,
    @Query('environment') environment?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for listing credentials.');
    }

    const input = ListCredentialsSchema.parse({ search, provider, equipmentType, environment, sortBy, sortDir, limit, offset });
    return this.knowledgeService.listCredentials(req.auth!.role || '', req.auth!.userId, {
      tenantId,
      ...input
    });
  }

  @Get('credentials/providers')
  async listCredentialProviders(
    @Req() req: RequestWithAuth,
    @Query('tenantId') tenantIdParam?: string,
    @Query('search') search?: string,
    @Query('equipmentType') equipmentType?: string,
    @Query('environment') environment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for listing credential providers.');
    }

    const input = ListCredentialProvidersSchema.parse({ search, equipmentType, environment, limit, offset });
    return this.knowledgeService.listCredentialProviders(req.auth!.role || '', req.auth!.userId, {
      tenantId,
      ...input
    });
  }

  @Post('credentials')
  async createCredential(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const input = CreateCredentialSchema.parse(body);
    const tenantId = input.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for creating credential.');
    }

    return this.knowledgeService.createCredential(req.auth!.role || '', req.auth!.userId, {
      ...input,
      tenantId
    });
  }

  @Post('credentials/:id/reveal')
  async revealCredential(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Query('tenantId') tenantIdParam?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for revealing credential.');
    }

    return this.knowledgeService.revealCredential(req.auth!.role || '', req.auth!.userId, tenantId, id);
  }

  @Get('notes')
  async listNotes(
    @Req() req: RequestWithAuth,
    @Query('tenantId') tenantIdParam?: string,
    @Query('search') search?: string,
    @Query('pinned') pinned?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for listing notes.');
    }

    const input = ListNotesSchema.parse({ search, pinned });
    return this.knowledgeService.listNotes(req.auth!.role || '', req.auth!.userId, {
      tenantId,
      ...input
    });
  }

  @Post('notes')
  async createNote(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const input = CreateNoteSchema.parse(body);
    const tenantId = input.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for creating note.');
    }

    return this.knowledgeService.createNote(req.auth!.role || '', req.auth!.userId, {
      ...input,
      tenantId
    });
  }

  @Patch('notes/:id')
  async patchNote(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query('tenantId') tenantIdParam?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for updating note.');
    }

    const patch = UpdateNoteSchema.parse(body);
    return this.knowledgeService.updateNote(req.auth!.role || '', req.auth!.userId, tenantId, id, patch);
  }

  @Delete('notes/:id')
  async deleteNote(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Query('tenantId') tenantIdParam?: string
  ) {
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for deleting note.');
    }

    return this.knowledgeService.deleteNote(req.auth!.role || '', req.auth!.userId, tenantId, id);
  }
}
