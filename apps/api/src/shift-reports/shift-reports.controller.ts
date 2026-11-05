import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { assertAnyRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaService } from '../prisma/prisma.service';
import { validatePathWithinBase } from '../common/path-security';

const ATTACHMENT_MAX_FILES = 10;
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_TOTAL_LIMIT = 20;
const ATTACHMENT_MIME_TYPES: Record<string, string[]> = {
  '.aac': ['audio/aac', 'audio/x-aac'],
  '.cfg': ['text/plain'],
  '.conf': ['text/plain'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.gif': ['image/gif'],
  '.jpeg': ['image/jpeg'],
  '.jpg': ['image/jpeg'],
  '.json': ['application/json'],
  '.log': ['text/plain'],
  '.m4a': ['audio/mp4', 'audio/x-m4a'],
  '.mp3': ['audio/mpeg'],
  '.odt': ['application/vnd.oasis.opendocument.text'],
  '.ogg': ['audio/ogg', 'application/ogg', 'audio/opus'],
  '.opus': ['audio/opus', 'audio/ogg'],
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.sql': ['application/sql', 'text/plain'],
  '.txt': ['text/plain'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.webm': ['audio/webm'],
  '.webp': ['image/webp'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xml': ['application/xml', 'text/xml'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

export const ReportInput = z
  .object({
    shift: z.enum(['DAY', 'NIGHT']),
    referenceDate: z.string().date(),
    content: z.string().trim().min(1).max(50000),
    orderIds: z.array(z.string().uuid()).max(100).default([]),
    expectedVersion: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.content.length < 20)
      ctx.addIssue({
        code: 'custom',
        message: 'Descreva o expediente antes de publicar (mínimo 20 caracteres).',
        path: ['content'],
      });
  });
@Controller('shift-reports')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ShiftReportsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private auth(req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return req.auth!;
  }
  @Get()
  list(@Req() req: RequestWithAuth, @Query() raw: unknown) {
    const a = this.auth(req);
    const q = z
      .object({
        mine: z.enum(['true', 'false']).optional(),
        shift: z.enum(['DAY', 'NIGHT']).optional(),
        author: z.string().uuid().optional(),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(raw);
    return this.prisma.shiftReport.findMany({
      where: {
        tenantId: a.tenantId!,
        ...(q.mine === 'true' ? { authorUserId: a.userId } : { publishedAt: { not: null } }),
        ...(q.author ? { authorUserId: q.mine === 'true' ? a.userId : q.author } : {}),
        ...(q.shift ? { shift: q.shift } : {}),
        referenceDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) },
      },
      select: {
        id: true,
        authorUserId: true,
        authorName: true,
        shift: true,
        referenceDate: true,
        publishedAt: true,
        version: true,
        _count: { select: { attachments: true } },
      },
      orderBy: [{ referenceDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      skip: q.offset,
    });
  }
  @Get('order-search')
  searchOrders(@Req() req: RequestWithAuth, @Query('q') raw: string) {
    const a = this.auth(req);
    // The orders list decorates protocols with '#'; accept the displayed/copied value.
    const q = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(
        z
          .string()
          .max(120)
          .parse(raw)
          .trim()
          .replace(/^#+\s*/, ''),
      );
    return this.prisma.serviceOrder.findMany({
      where: {
        tenantId: a.tenantId!,
        deletedAt: null,
        OR: [
          { id: q },
          { protocol: { contains: q, mode: 'insensitive' } },
          { externalProtocol: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, protocol: true, title: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
  }
  @Get('authors')
  async authors(@Req() req: RequestWithAuth) {
    const a = this.auth(req);
    return this.prisma.shiftReport.findMany({
      where: {
        tenantId: a.tenantId!,
        OR: [{ publishedAt: { not: null } }, { authorUserId: a.userId }],
      },
      distinct: ['authorUserId'],
      select: { authorUserId: true, authorName: true },
      orderBy: { authorName: 'asc' },
    });
  }
  @Get(':id')
  async detail(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const a = this.auth(req);
    const row = await this.prisma.shiftReport.findFirst({
      where: {
        id,
        tenantId: a.tenantId!,
        OR: [{ authorUserId: a.userId }, { publishedAt: { not: null } }],
      },
    });
    if (!row) throw new NotFoundException('Relatório não encontrado.');
    return {
      ...row,
      linkedOrders: await this.prisma.serviceOrder.findMany({
        where: { id: { in: row.orderIds as string[] }, tenantId: a.tenantId!, deletedAt: null },
        select: { id: true, protocol: true, title: true },
      }),
      attachments: await this.prisma.shiftReportAttachment.findMany({
        where: { reportId: row.id },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: 'desc' },
      }),
    };
  }
  @Post(':id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', ATTACHMENT_MAX_FILES, {
      limits: { fileSize: ATTACHMENT_MAX_BYTES, files: ATTACHMENT_MAX_FILES },
    }),
  )
  async uploadAttachments(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File> | undefined,
  ) {
    const a = this.auth(req);
    if (!files?.length) throw new BadRequestException('Selecione pelo menos um arquivo.');
    const report = await this.prisma.shiftReport.findFirst({
      where: { id, tenantId: a.tenantId!, authorUserId: a.userId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Somente o autor pode anexar arquivos ao relatório.');
    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const reportDir = join(uploadRoot, 'shift-reports', report.id);
    const prepared = files.map((file) => {
      const safeName = [...basename((file.originalname || 'arquivo').replace(/\\/g, '/'))]
        .map((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127 ? '_' : character;
        })
        .join('')
        .slice(0, 180);
      const extension = extname(safeName).toLowerCase();
      const mimeType = (file.mimetype || '').split(';')[0].trim().toLowerCase();
      if (!ATTACHMENT_MIME_TYPES[extension]?.includes(mimeType)) {
        throw new BadRequestException(
          `Formato não permitido: ${extension || 'arquivo sem extensão'}.`,
        );
      }
      if (!file.size || file.size > ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException('Cada anexo deve ter até 10 MB.');
      }
      const storedName = `${randomUUID()}${extension}`;
      return {
        fileName: safeName,
        mimeType,
        sizeBytes: file.size,
        storageKey: join('shift-reports', report.id, storedName),
        buffer: file.buffer,
      };
    });
    await mkdir(reportDir, { recursive: true });
    const storedPaths: string[] = [];
    try {
      for (const file of prepared) {
        const path = join(uploadRoot, file.storageKey);
        await writeFile(path, file.buffer, { flag: 'wx' });
        storedPaths.push(path);
      }
      const attachments = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.shiftReportAttachment.count({ where: { reportId: report.id } });
        if (existing + prepared.length > ATTACHMENT_TOTAL_LIMIT) {
          throw new ConflictException(
            `O relatório aceita no máximo ${ATTACHMENT_TOTAL_LIMIT} anexos.`,
          );
        }
        const created = [];
        for (const file of prepared) {
          const attachment = await tx.shiftReportAttachment.create({
            data: {
              reportId: report.id,
              fileName: file.fileName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              storageKey: file.storageKey,
              uploadedById: a.userId,
            },
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true,
            },
          });
          created.push(attachment);
        }
        await tx.auditLog.create({
          data: {
            tenantId: a.tenantId!,
            actorUserId: a.userId,
            action: 'SHIFT_REPORT_SAVE',
            resourceType: 'shift_report_attachment',
            resourceId: report.id,
            metadata: {
              operation: 'attachment-upload',
              count: created.length,
              fileNames: created.map((attachment) => attachment.fileName),
            },
          },
        });
        return created;
      });
      return attachments;
    } catch (error) {
      await Promise.all(storedPaths.map((path) => rm(path, { force: true })));
      throw error;
    }
  }
  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const a = this.auth(req);
    const report = await this.prisma.shiftReport.findFirst({
      where: {
        id,
        tenantId: a.tenantId!,
        OR: [{ authorUserId: a.userId }, { publishedAt: { not: null } }],
      },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Relatório não encontrado.');
    const attachment = await this.prisma.shiftReportAttachment.findFirst({
      where: { id: attachmentId, reportId: report.id },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const safePath = validatePathWithinBase(uploadRoot, attachment.storageKey);
    if (!existsSync(safePath)) throw new NotFoundException('Arquivo do anexo não encontrado.');
    await this.prisma.auditLog.create({
      data: {
        tenantId: a.tenantId!,
        actorUserId: a.userId,
        action: 'SHIFT_REPORT_SAVE',
        resourceType: 'shift_report_attachment',
        resourceId: attachment.id,
        metadata: { operation: 'attachment-download', reportId: report.id },
      },
    });
    res.setHeader('content-type', attachment.mimeType || 'application/octet-stream');
    res.setHeader(
      'content-disposition',
      `${attachment.mimeType.startsWith('audio/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.fileName)}"`,
    );
    res.setHeader('content-length', attachment.sizeBytes);
    res.setHeader('cache-control', 'private, no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    const stream = createReadStream(safePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ message: 'Falha ao ler o anexo.' });
      else res.destroy();
    });
    stream.pipe(res);
  }
  @Post()
  create(@Req() req: RequestWithAuth, @Body() raw: unknown) {
    return this.save(req, raw);
  }
  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() raw: unknown) {
    return this.save(req, raw, id);
  }
  private async save(req: RequestWithAuth, raw: unknown, id?: string) {
    const a = this.auth(req),
      v = ReportInput.parse(raw);
    return this.prisma.$transaction(async (tx) => {
      const prior = id
        ? await tx.shiftReport.findFirst({
            where: { id, tenantId: a.tenantId!, authorUserId: a.userId },
          })
        : null;
      if (id && !prior) throw new NotFoundException('Somente o autor pode editar este relatório.');
      const ids = [...new Set(v.orderIds)];
      if (
        ids.length !==
        (await tx.serviceOrder.count({
          where: { id: { in: ids }, tenantId: a.tenantId!, deletedAt: null },
        }))
      )
        throw new NotFoundException('O.S. fora da empresa ou indisponível.');
      const author = await tx.user.findUniqueOrThrow({
        where: { id: a.userId },
        select: { name: true },
      });
      const now = new Date();
      const data = {
        shift: v.shift,
        referenceDate: v.referenceDate,
        content: v.content,
        orderIds: ids,
        publishedAt: prior?.publishedAt || now,
      };
      const revisions = prior
        ? [
            ...(prior.revisions as Prisma.JsonArray),
            ...(prior.publishedAt
              ? [
                  JSON.parse(
                    JSON.stringify({
                      version: prior.version,
                      at: prior.updatedAt,
                      content: prior.content,
                      startAt: prior.startAt,
                      endAt: prior.endAt,
                      shift: prior.shift,
                      referenceDate: prior.referenceDate,
                      orderIds: prior.orderIds,
                    }),
                  ),
                ]
              : []),
          ]
        : [];
      if (prior) {
        const result = await tx.shiftReport.updateMany({
          where: {
            id: prior.id,
            tenantId: a.tenantId!,
            authorUserId: a.userId,
            version: v.expectedVersion ?? -1,
          },
          data: { ...data, version: { increment: 1 }, revisions },
        });
        if (!result.count)
          throw new ConflictException(
            'O relatório mudou. Reabra antes de salvar para não perder outra edição.',
          );
      }
      const saved = prior
        ? await tx.shiftReport.findUniqueOrThrow({ where: { id: prior.id } })
        : await tx.shiftReport.create({
            data: {
              ...data,
              tenantId: a.tenantId!,
              authorUserId: a.userId,
              authorName: author.name,
            },
          });
      await tx.auditLog.create({
        data: {
          tenantId: a.tenantId!,
          actorUserId: a.userId,
          action: 'SHIFT_REPORT_SAVE',
          resourceType: 'shift_report',
          resourceId: saved.id,
          metadata: { version: saved.version, published: Boolean(saved.publishedAt) },
        },
      });
      return saved;
    });
  }
}
