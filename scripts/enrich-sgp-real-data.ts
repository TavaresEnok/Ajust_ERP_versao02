import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { readSgp } from '../apps/api/src/service-processes/sgp-reader';
import { SGP_CUSTOMERS } from '../apps/api/src/customers/import-sgp-registry';
import { parseAccessNote } from '../apps/api/src/customers/sgp-credential-parser';
import { encryptVaultSecret as encryptSecret } from '../apps/api/src/common/vault.crypto';
import { sgpDate } from '../apps/api/src/service-processes/import-sgp-pilot';
import { safeSgpText } from '../apps/api/src/service-processes/import-sgp-sample';
import { makeOperationalDefinition } from '../apps/api/src/service-processes/operational-definition';

const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
function date(v: unknown) {
  try {
    return v ? sgpDate(String(v), 'America/Fortaleza') : null;
  } catch {
    return null;
  }
}
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const tid = tenant.id;
  const actor = await db.userTenant.findFirstOrThrow({
    where: { tenantId: tid, role: { code: 'gerente' }, user: { status: 'ACTIVE' } },
  });
  const stats: any = {
    apply,
    credentials: [],
    orders: 0,
    orderNotes: 0,
    occurrenceComments: 0,
    calendar: 0,
    files: 0,
    fileBytes: 0,
    pendingMedia: 0,
    catalog: 0,
    unknownTimeRecords: 0,
    failures: [],
    fixtureCredentialsRemoved: 0,
  };
  async function linked(
    kind: string,
    key: string,
    create: (tx: Prisma.TransactionClient) => Promise<{ id: string }>,
    metadata: unknown = {},
  ) {
    if (!apply) return;
    const unique = { tenantId: tid, kind, externalKey: key };
    if (await db.externalImportLink.findUnique({ where: { tenantId_kind_externalKey: unique } }))
      return;
    await db.$transaction(async (tx) => {
      const item = await create(tx);
      await tx.externalImportLink.create({
        data: { ...unique, localId: item.id, metadata: json(metadata) },
      });
    });
  }
  const notes = await readSgp('/api/ura/cliente/anotacao/list', {}, 'GET');
  if (!Array.isArray(notes)) throw new Error('Formato de anotações desconhecido.');
  for (const spec of SGP_CUSTOMERS) {
    const owned = notes.filter((n) => Number(n.cliente) === spec.id);
    let parsed = 0,
      complete = 0,
      ambiguous = 0;
    for (const note of owned) {
      const parts = parseAccessNote(String(note.anotacao || ''), Number(note.id));
      for (const part of parts) {
        parsed++;
        if (!part.missing.length) complete++;
        if (part.ambiguous) ambiguous++;
        if (!apply) continue;
        const externalId = `ajustconsulting.sgp.net.br:cliente:${spec.id}:anotacao:${note.id}:parte:${part.part}`;
        await db.knowledgeCredential.upsert({
          where: {
            tenantId_sourceSystem_externalId: { tenantId: tid, sourceSystem: 'SGP', externalId },
          },
          create: {
            tenantId: tid,
            createdById: actor.userId,
            provider: spec.tradeName,
            equipmentType: part.equipmentType,
            equipmentName: part.equipmentName,
            environment: 'NAO_INFORMADO',
            host: part.host,
            username: part.username,
            secretEnc: encryptSecret(part.secret),
            sourceNoteEnc: encryptSecret(part.sourceText),
            sourceSystem: 'SGP',
            externalId,
            sourceMetadata: {
              sourceCustomerId: spec.id,
              noteId: note.id,
              part: part.part,
              sourceType: note.tipo,
              sourceAuthorId: note.usuario,
              sourceHash: hash(String(note.anotacao)),
              missingFields: part.missing,
              ambiguous: part.ambiguous,
              reviewRequired: !!part.missing.length || part.ambiguous,
            },
            notes: `Origem: anotação SGP #${note.id}, cliente ${spec.id}. ${part.missing.length ? `Campos não identificados com segurança: ${part.missing.join(', ')}. ` : ''}${part.ambiguous ? 'Há múltiplos pares de acesso; revise a anotação original. ' : ''}Conteúdo original protegido, disponível por revelação auditada. Ambiente não informado pela origem.`,
            ...(date(note.data_cadastro) ? { createdAt: date(note.data_cadastro)! } : {}),
            ...(date(note.data_alteracao) ? { updatedAt: date(note.data_alteracao)! } : {}),
          },
          update: {},
        });
      }
    }
    stats.credentials.push({
      provider: spec.tradeName,
      sourceNotes: owned.length,
      accessRecords: parsed,
      complete,
      ambiguous,
    });
  }
  // Exact known e2e fixtures only; archive encrypted rows before deletion for recovery.
  if (apply) {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS migration_archive');
      await tx.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS migration_archive.credentials_e2e_20261021 AS SELECT * FROM "KnowledgeCredential" WITH NO DATA',
      );
      await tx.$executeRaw`INSERT INTO migration_archive.credentials_e2e_20261021 SELECT * FROM "KnowledgeCredential" WHERE "tenantId"=${tid} AND provider='IXC Soft' AND host='https://ixc.provedor.com.br' AND username='admin_e2e' AND "sourceSystem"='ERP'`;
      const removed = await tx.knowledgeCredential.deleteMany({
        where: {
          tenantId: tid,
          provider: 'IXC Soft',
          host: 'https://ixc.provedor.com.br',
          username: 'admin_e2e',
          sourceSystem: 'ERP',
        },
      });
      stats.fixtureCredentialsRemoved = removed.count;
      if (removed.count)
        await tx.auditLog.create({
          data: {
            tenantId: tid,
            actorUserId: actor.userId,
            action: 'SYNC',
            resourceType: 'credential_fixture_cleanup',
            metadata: {
              removed: removed.count,
              recovery: 'migration_archive.credentials_e2e_20261021',
            },
          },
        });
    });
  }
  const users = await db.user.findMany({
    where: { sourceSystem: 'SGP', tenants: { some: { tenantId: tid } } },
    select: { id: true, name: true, sourceMetadata: true },
  });
  const author = (name: string) => {
    const matches = users.filter(
      (u) =>
        u.name.trim().toLowerCase() === String(name).trim().toLowerCase() ||
        String((u.sourceMetadata as any)?.sourceUsername || '').toLowerCase() ===
          String(name).trim().toLowerCase(),
    );
    return matches.length === 1 ? matches[0].id : undefined;
  };
  const orders = await db.serviceOrder.findMany({
    where: {
      tenantId: tid,
      sourceSystem: 'SGP',
      externalProtocol: { startsWith: 'ajustconsulting.sgp.net.br:os:' },
    },
    include: { occurrence: true },
  });
  for (const order of orders) {
    const sid = Number(order.externalProtocol!.split(':').at(-1));
    const spec = SGP_CUSTOMERS.find(
      (s) =>
        s.id === Number((order.sourceMetadata as any).sourceCustomerId) ||
        s.id === Number((order.occurrence?.sourceMetadata as any)?.sourceCustomerId) ||
        s.id === Number((order.occurrence?.sourceMetadata as any)?.clientId),
    );
    if (!spec || !order.occurrence) throw new Error('Pedido fora dos clientes autorizados.');
    try {
      const d = await readSgp(`/api/os/list/id/${sid}`);
      if (
        Number(d.cliente_id) !== spec.id ||
        Number(d.os_id) !== sid ||
        String(d.os_protocolo) !== order.occurrence.number
      )
        throw new Error('Vínculo SGP divergente.');
      const [annotations, occComments, images] = await Promise.all([
        readSgp(`/api/os/anotacoes/list/id/${sid}/`),
        readSgp(`/api/os/ocorrencia/comentario/list/id/${sid}/`),
        readSgp(`/api/os/imagem/id/${sid}/list/`, {}, 'GET'),
      ]);
      for (const [index, note] of (Array.isArray(annotations) ? annotations : []).entries()) {
        const message = safeSgpText(note.anotacao || note.conteudo || note.comentario);
        if (!message) continue;
        const externalId = String(
          note.id || note.anotacao_id || hash(JSON.stringify([index, note.data_cadastro, message])),
        );
        await linked('ORDER_NOTE', `${sid}:${externalId}`, (tx) =>
          tx.serviceOrderOccurrence.create({
            data: {
              serviceOrderId: order.id,
              sourceSystem: 'SGP',
              externalId: `note:${externalId}`,
              message: `[Anotação SGP]\n${message}`,
              sourceAuthorName: String(note.usuario || 'Não informado'),
              ...(author(note.usuario) ? { actorUserId: author(note.usuario) } : {}),
              isCustomerVisible: false,
              ...(date(note.data_cadastro) ? { createdAt: date(note.data_cadastro)! } : {}),
            },
          }),
        );
        stats.orderNotes++;
      }
      for (const note of Array.isArray(occComments) ? occComments : []) {
        if (
          note.ocorrencia_id &&
          Number(note.ocorrencia_id) !== Number(order.occurrence.externalId)
        )
          throw new Error('Comentário de outra ocorrência.');
        const message = safeSgpText(note.anotacao || note.comentario);
        if (!message) continue;
        const key = String(
          note.id ||
            hash(JSON.stringify([order.occurrenceId, note.usuario, note.data_cadastro, message])),
        );
        await linked('OCCURRENCE_COMMENT', key, (tx) =>
          tx.occurrenceAnnotation.create({
            data: {
              tenantId: tid,
              occurrenceId: order.occurrenceId!,
              message: `[Comentário SGP · ${note.usuario || 'autor não informado'}]\n${message}`,
              ...(author(note.usuario) ? { actorUserId: author(note.usuario) } : {}),
              isCustomerVisible: false,
              ...(date(note.data_cadastro) ? { createdAt: date(note.data_cadastro)! } : {}),
            },
          }),
        );
        stats.occurrenceComments++;
      }
      for (const [field, label] of [
        ['os_anotacao', 'Anotação'],
        ['os_observacao', 'Observação'],
        ['os_servicoprestado', 'Serviço prestado'],
      ] as const) {
        const message = safeSgpText(d[field]);
        if (!message) continue;
        await linked('ORDER_FIELD', `${sid}:${field}`, (tx) =>
          tx.serviceOrderOccurrence.create({
            data: {
              serviceOrderId: order.id,
              sourceSystem: 'SGP',
              externalId: `field:${field}`,
              message: `[${label} SGP]\n${message}`,
              sourceAuthorName: String(d.os_tecnico_responsavel || ''),
              isCustomerVisible: false,
              createdAt: date(d.os_data_finalizacao) || order.createdAt,
            },
          }),
        );
      }
      const scheduled = date(d.os_data_agendamento);
      if (scheduled) {
        await linked(
          'CALENDAR',
          String(sid),
          (tx) =>
            tx.calendarEvent.create({
              data: {
                tenantId: tid,
                title: `SGP-${sid} · ${spec.tradeName}`,
                description: `Agendamento original SGP. Confirmação: ${d.os_agendamento_confirmado ? 'confirmado' : 'não confirmado'}. ${safeSgpText(d.os_conteudo).slice(0, 1500)}`,
                type: 'OUTRO',
                isGlobal: false,
                startAt: scheduled,
                endAt: null,
                createdById: actor.userId,
                ...(order.assigneeUserId ? { assigneeId: order.assigneeUserId } : {}),
                serviceOrderId: order.id,
                occurrenceId: order.occurrenceId,
              },
            }),
          { sourceConfirmed: !!d.os_agendamento_confirmado, endAtKnown: false },
        );
        stats.calendar++;
      }
      const opened = date(d.os_data_cadastro),
        closed = date(d.os_data_finalizacao);
      const duration =
        opened && closed && closed >= opened
          ? Math.round((closed.getTime() - opened.getTime()) / 60000)
          : null;
      const timeFields = Object.keys(d).filter((k) =>
        /tempo|duracao|duration|checkin|checkout/i.test(k),
      );
      if (!timeFields.length) stats.unknownTimeRecords++;
      if (apply)
        await db.serviceOrder.update({
          where: { id: order.id },
          data: {
            sourceMetadata: json({
              ...(order.sourceMetadata as object),
              enrichment: {
                scheduledAt: scheduled?.toISOString() || null,
                scheduleConfirmed: !!d.os_agendamento_confirmado,
                elapsedMinutes: duration,
                elapsedBasis: 'SOURCE_OPEN_TO_CLOSE_NOT_WORKLOG',
                workMinutes: null,
                workTimeStatus: timeFields.length ? 'REQUIRES_REVIEW' : 'NOT_EXPOSED_BY_API',
                timeFieldNames: timeFields,
                checklistStatus: 'SEPARATE_ENDPOINT',
                imagesCount: Array.isArray(images) ? images.length : null,
              },
            }),
          },
        });
      const type = String(order.occurrence.type);
      const def = makeOperationalDefinition(type);
      await linked(
        'CATALOG',
        type,
        (tx) =>
          tx.serviceCatalogItem.create({
            data: {
              tenantId: tid,
              name: type,
              category: def.nodes[0].serviceType,
              description: `Tipo de ocorrência real do SGP, observado nas O.S. importadas. Sem estimativa de duração ou SLA contratual informado pela API.`,
              estimatedMinutes: null,
              defaultPriority: 'NORMAL',
              checklist: [],
              active: true,
            },
          }),
        { priorityVerified: false },
      );
      stats.catalog++;
      const sourceAttachments: Record<string, unknown>[] = [];
      for (const image of Array.isArray(images) ? images : []) {
        const imageKey = String(image.id || image.imagem_id || image.arquivo || image.url || '');
        if (!imageKey) {
          stats.failures.push({ order: sid, kind: 'ATTACHMENT_NO_KEY', keys: Object.keys(image) });
          continue;
        }
        const key = `${sid}:${hash(imageKey)}`;
        if (
          await db.externalImportLink.findUnique({
            where: {
              tenantId_kind_externalKey: { tenantId: tid, kind: 'ATTACHMENT', externalKey: key },
            },
          })
        )
          continue;
        const rawUrl = image.url || image.imagem || image.arquivo;
        if (typeof rawUrl !== 'string') {
          stats.failures.push({ order: sid, kind: 'ATTACHMENT_FORMAT', keys: Object.keys(image) });
          continue;
        }
        const url = new URL(
          !rawUrl.startsWith('/') && !/^https?:/i.test(rawUrl) ? `/media/${rawUrl}` : rawUrl,
          'https://ajustconsulting.sgp.net.br',
        );
        if (
          url.origin !== 'https://ajustconsulting.sgp.net.br' ||
          !url.pathname.startsWith('/media/') ||
          url.username ||
          url.password
        ) {
          stats.failures.push({
            order: sid,
            kind: 'ATTACHMENT_URL_NOT_ALLOWED',
            keys: Object.keys(image),
          });
          continue;
        }
        if (!apply) continue;
        const reference = {
          sourceImageId: image.id,
          fileName: basename(url.pathname),
          description: safeSgpText(image.descricao),
          sourceAuthorName: String(image.usuario || ''),
          sourcePath: url.pathname,
          availability: 'AVAILABLE',
        };
        const response = await fetch(url, {
          signal: AbortSignal.timeout(45000),
          redirect: 'manual',
        });
        if (!response.ok) {
          reference.availability =
            response.status === 302 ? 'SOURCE_LOGIN_REQUIRED' : `SOURCE_HTTP_${response.status}`;
          sourceAttachments.push(reference);
          stats.pendingMedia++;
          await linked('ATTACHMENT_REFERENCE', key, async () => ({ id: order.id }), reference);
          continue;
        }
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const r = await reader.read();
          if (r.done) break;
          size += r.value.byteLength;
          if (size > 50 * 1024 * 1024) {
            await reader.cancel();
            throw new Error('Anexo excede 50MB');
          }
          chunks.push(r.value);
        }
        const bytes = Buffer.concat(chunks),
          root = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
        const folder = join(root, 'service-orders', order.id);
        await mkdir(folder, { recursive: true });
        const fileName = basename(url.pathname);
        const target = join(
          folder,
          `sgp_${hash(key).slice(0, 24)}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        );
        await writeFile(target, bytes, { mode: 0o600 });
        await linked(
          'ATTACHMENT',
          key,
          (tx) =>
            tx.serviceOrderAttachment.create({
              data: {
                serviceOrderId: order.id,
                fileName,
                mimeType:
                  response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
                sizeBytes: bytes.length,
                storageKey: target,
                isInternal: true,
                uploadedAt: date(image.data_cadastro) || order.createdAt,
              },
            }),
          { sha256: hash(bytes.toString('base64')), sourceOrderId: sid },
        );
        stats.files++;
        stats.fileBytes += bytes.length;
        sourceAttachments.push(reference);
      }
      if (apply) {
        const latest = await db.serviceOrder.findUniqueOrThrow({
          where: { id: order.id },
          select: { sourceMetadata: true },
        });
        const meta = latest.sourceMetadata as Record<string, any>;
        await db.serviceOrder.update({
          where: { id: order.id },
          data: {
            sourceMetadata: json({
              ...meta,
              enrichment: { ...meta.enrichment, sourceAttachments },
            }),
          },
        });
      }
      stats.orders++;
    } catch (error) {
      stats.failures.push({
        order: sid,
        kind:
          error instanceof Error
            ? error.message.replace(/https?:\/\/\S+/g, '[endereço removido]')
            : 'erro',
      });
    }
  }
  if (apply)
    await db.auditLog.create({
      data: {
        tenantId: tid,
        actorUserId: actor.userId,
        action: 'SYNC',
        resourceType: 'sgp_real_enrichment',
        metadata: json(stats),
      },
    });
  console.log(JSON.stringify(stats));
  if (stats.failures.length) process.exitCode = 2;
}
main()
  .catch((e) => {
    console.error(
      e instanceof Error && e.name === 'Error'
        ? e.message.replace(/https?:\/\/\S+/g, '[endereço removido]')
        : e.name || 'Erro',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
