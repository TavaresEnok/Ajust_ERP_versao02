-- Consultas SÓ DE LEITURA para achar dados inconsistentes (Fase 5 da análise).
-- Rode na base real (produção) com um usuário somente leitura. Cada linha devolve um número;
-- o esperado é 0, salvo onde indicado. A referência (C-xxx) aponta para docs/auditoria/CORRECOES.md.

-- C-004 / C-014: datas de fechamento incoerentes com o status
SELECT 'fechadas sem closedAt' AS verificacao, count(*) FROM "ServiceOrder" WHERE status = 'FECHADA' AND "closedAt" IS NULL;
SELECT 'fechadas sem resolvedAt', count(*) FROM "ServiceOrder" WHERE status = 'FECHADA' AND "resolvedAt" IS NULL;
SELECT 'canceladas sem canceledAt', count(*) FROM "ServiceOrder" WHERE status = 'CANCELADA' AND "canceledAt" IS NULL;
SELECT 'ativas com data de fechamento/resolução', count(*) FROM "ServiceOrder"
 WHERE status NOT IN ('FECHADA','CANCELADA') AND ("closedAt" IS NOT NULL OR "resolvedAt" IS NOT NULL) AND "deletedAt" IS NULL;

-- C-034 / C-045: ocorrência encerrada com O.S. ativa, e o contrário
SELECT 'O.S. ativa em ocorrência encerrada', count(*) FROM "ServiceOrder" o JOIN "Occurrence" c ON c.id = o."occurrenceId"
 WHERE c.status = 'ENCERRADA' AND o.status NOT IN ('FECHADA','CANCELADA') AND o."deletedAt" IS NULL;
SELECT 'ocorrência aberta sem O.S. ativa', count(*) FROM "Occurrence" c
 WHERE c.status <> 'ENCERRADA' AND c."deletedAt" IS NULL AND NOT EXISTS (
   SELECT 1 FROM "ServiceOrder" o WHERE o."occurrenceId" = c.id AND o.status NOT IN ('FECHADA','CANCELADA') AND o."deletedAt" IS NULL);

-- C-008 / C-045: chamados órfãos
SELECT 'O.S. sem ocorrência', count(*) FROM "ServiceOrder" WHERE "occurrenceId" IS NULL AND "deletedAt" IS NULL;
SELECT 'ocorrência sem provedor cadastrado', count(*) FROM "Occurrence" WHERE "customerId" IS NULL AND "deletedAt" IS NULL;
SELECT 'nome do provedor diferente do cadastro', count(*) FROM "Occurrence" c JOIN "Customer" k ON k.id = c."customerId"
 WHERE c.provider IS DISTINCT FROM COALESCE(k."tradeName", k."legalName");

-- C-005 / C-006: prazos e datas suspeitas
SELECT 'prazo antes da abertura', count(*) FROM "ServiceOrder" WHERE "deadlineAt" < "createdAt";
SELECT 'fechamento antes da abertura', count(*) FROM "ServiceOrder" WHERE "closedAt" < "createdAt";
SELECT 'ocorrência com abertura no futuro', count(*) FROM "Occurrence" WHERE "createdAt" > now();

-- C-007 / C-037 / C-070: responsáveis
SELECT 'nome do analista diferente do usuário responsável', count(*) FROM "ServiceOrder" o JOIN "User" u ON u.id = o."assigneeUserId"
 WHERE o."analystName" IS DISTINCT FROM u.name;
SELECT 'responsável que não é membro do tenant', count(*) FROM "ServiceOrder" o
 WHERE o."assigneeUserId" IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM "UserTenant" ut WHERE ut."userId" = o."assigneeUserId" AND ut."tenantId" = o."tenantId");
SELECT 'responsável com papel cliente', count(*) FROM "ServiceOrder" o
 JOIN "UserTenant" ut ON ut."userId" = o."assigneeUserId" AND ut."tenantId" = o."tenantId"
 JOIN "Role" r ON r.id = ut."roleId" WHERE r.code = 'cliente';

-- C-019: contas cliente sem provedor (o esperado é 0)
SELECT 'cliente sem provedor vinculado', count(*) FROM "UserTenant" ut JOIN "Role" r ON r.id = ut."roleId"
 WHERE r.code = 'cliente' AND ut."customerId" IS NULL;

-- C-034: O.S. criadas por modelos/workflows (possíveis duplicadas ou em laço)
SELECT 'O.S. com prefixo WF-', count(*) FROM "ServiceOrder" WHERE protocol LIKE 'WF-%';
SELECT 'origem com mais de 1 leva do mesmo modelo', count(*) FROM (
  SELECT "occurrenceId", tags FROM "ServiceOrder" WHERE protocol LIKE 'WF-%' GROUP BY 1, 2 HAVING count(*) > 1) t;

-- C-044: alertas do Zabbix repetidos
SELECT 'ocorrências ZBX nas últimas 24h', count(*) FROM "Occurrence" WHERE number LIKE 'ZBX-%' AND "createdAt" > now() - interval '24 hours';

-- C-067: distribuição de protocolos por formato (informativo)
SELECT COALESCE(substring(protocol FROM '^([A-Z]+)-'), CASE WHEN protocol ~ '^[0-9]{10}$' THEN 'AAAA+6' ELSE 'outro' END) AS formato,
       count(*) FROM "ServiceOrder" GROUP BY 1 ORDER BY 2 DESC;

-- C-054: credenciais ainda com a chave antiga (informativo; o ideal é 0)
SELECT 'credenciais fora do formato vault:v1', count(*) FROM "KnowledgeCredential" WHERE "secretEnc" <> '' AND "secretEnc" NOT LIKE 'vault:v1:%';

-- C-073: sessões expiradas acumuladas (informativo)
SELECT 'sessões expiradas não removidas', count(*) FROM "Session" WHERE "expiresAt" < now();
