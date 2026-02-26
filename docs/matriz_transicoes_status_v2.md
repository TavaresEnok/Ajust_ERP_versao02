# Matriz de Transicoes de Status v2 (QA)

Data base: 2026-02-17
Escopo: MVP ERP Ajust

## 1) Status oficiais

- `ABERTA`
- `EM_ANALISE`
- `AG_CAMPO`
- `AG_TERCEIROS`
- `RESOLVIDA`
- `FECHADA`
- `CANCELADA`

## 2) Papeis

- `super_admin`
- `gerente`
- `analista`
- `tecnico`
- `cliente`
- `leitura`

## 3) Regras globais

- `cliente` e `leitura` nao executam transicoes de status.
- `tecnico` so pode levar OS para `RESOLVIDA`.
- Fechamento de OS (`RESOLVIDA -> FECHADA`) por `analista`, `gerente`, `super_admin`.
- Se OS `CRITICA` ou `ALTA` estiver atrasada no SLA, `RESOLVIDA -> FECHADA` exige aprovacao.
- Reabertura oficial: `FECHADA -> EM_ANALISE`.
- Cancelamento permitido apenas a partir de `ABERTA` ou `EM_ANALISE`.

## 4) Tabela de transicoes permitidas

| Origem | Destino | Quem pode executar | Condicao obrigatoria |
|---|---|---|---|
| ABERTA | EM_ANALISE | analista, gerente, super_admin | Nenhuma |
| ABERTA | CANCELADA | analista, gerente, super_admin | Registrar motivo de cancelamento |
| EM_ANALISE | AG_CAMPO | analista, gerente, super_admin | Definir responsavel tecnico/campo |
| EM_ANALISE | AG_TERCEIROS | analista, gerente, super_admin | Definir terceiro/parceiro e observacao |
| EM_ANALISE | RESOLVIDA | tecnico, analista, gerente, super_admin | Evidencia minima na ocorrencia |
| EM_ANALISE | CANCELADA | analista, gerente, super_admin | Registrar motivo de cancelamento |
| AG_CAMPO | EM_ANALISE | analista, gerente, super_admin | Registrar retorno da triagem |
| AG_CAMPO | RESOLVIDA | tecnico, analista, gerente, super_admin | Evidencia tecnica anexada/ocorrencia |
| AG_TERCEIROS | RESOLVIDA | tecnico, analista, gerente, super_admin | Evidencia de retorno do terceiro |
| AG_TERCEIROS | EM_ANALISE | analista, gerente, super_admin | Motivo de retorno interno |
| RESOLVIDA | FECHADA | analista, gerente, super_admin | Aprovar quando prioridade ALTA/CRITICA atrasada |
| RESOLVIDA | EM_ANALISE | analista, gerente, super_admin | Motivo de retrabalho |
| FECHADA | EM_ANALISE | analista, gerente, super_admin | Motivo de reabertura |

## 5) Transicoes explicitamente bloqueadas

- Qualquer origem -> `CANCELADA` diferente de `ABERTA`/`EM_ANALISE`.
- `AG_TERCEIROS -> FECHADA` direto (deve passar por `RESOLVIDA`).
- `ABERTA -> FECHADA` direto.
- `tecnico` para qualquer destino que nao seja `RESOLVIDA`.
- Alteracao de status por `cliente` e `leitura`.

## 6) Casos de teste QA (minimo)

- CT-01: `ABERTA -> CANCELADA` por analista com motivo preenchido (sucesso).
- CT-02: `AG_TERCEIROS -> FECHADA` por gerente (bloqueio esperado).
- CT-03: `RESOLVIDA -> FECHADA` em OS CRITICA atrasada sem aprovacao (bloqueio esperado).
- CT-04: `RESOLVIDA -> FECHADA` em OS CRITICA atrasada com aprovacao (sucesso).
- CT-05: `FECHADA -> EM_ANALISE` por analista com motivo (sucesso).
- CT-06: `EM_ANALISE -> AG_CAMPO` por tecnico (bloqueio esperado).
- CT-07: `EM_ANALISE -> RESOLVIDA` por tecnico com evidencia (sucesso).
- CT-08: Tentativa de transicao por perfil `cliente` (bloqueio esperado).

## 7) Auditoria obrigatoria por transicao

Em toda transicao aprovada, registrar:
- `actor_user_id`
- `tenant_id`
- `service_order_id`
- `from_status`
- `to_status`
- `reason`
- `at`
- `source` (ERP/SGP/webhook/polling)
