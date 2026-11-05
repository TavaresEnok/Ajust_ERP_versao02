# Ordem de ataque das correções

> Base: [CORRECOES.md](./CORRECOES.md) (C-001 a C-085). C-003 é o registro do que já foi corrigido em 04/11 e só falta commitar (entra no Lote 6, junto com C-072). Os lotes seguem **risco** e **dependência**:
> cada lote deixa o sistema funcionando e destrava o seguinte. Os itens "precisa de decisão" estão
> reunidos no fim; vale decidi-los antes do Lote 3.

## Lote 0 — Contenção do servidor (horas, não dias)
Objetivo: fechar o que está aberto para a internet **hoje**. Mexe em infraestrutura e derruba sessões;
combinar uma janela.

1. **Backup antes de tudo** (C-076): `pg_dump` + cópia de `uploads/` **e** de `uploads/.keys/vault.key` para fora do servidor.
2. **Portas** (C-046): Postgres, Redis, pgAdmin e worker só em `127.0.0.1` (ou sem `ports`); remover o pgAdmin; conferir o firewall do provedor de fora.
3. **Redis com senha** (C-046 + **C-065 junto**, senão o worker para) e `noeviction` (C-077).
4. **Segredos** (C-047 + C-078): gerar todos (JWT de acesso, refresh e reset, `SECRETS_ENCRYPTION_KEY`, tokens de webhook e do worker, senha do Postgres); fazer o compose ler `.env` e falhar sem eles; `NODE_ENV=production`; revogar todas as sessões. Recriptografar 2FA, IXC e topologias com a chave nova.
5. **TLS** (C-075): ERP atrás do nginx do host com certificado; `web` em `127.0.0.1`.
6. **Backup automático** diário fora do servidor (C-076, C-058).

## Lote 1 — Acesso e tomada de conta (1 a 2 dias)
Críticos de aplicação, todos pequenos e isolados.

- C-019 cliente sem vínculo → bloqueado; filtro por `customerId` nos serviços; corrigir o vínculo existente (+ socket, C-053).
- C-020 `createUser` não toca em senha de conta existente.
- C-021 gerente não edita, remove nem troca senha de super_admin; analista sem escopo entre tenants.
- C-048 troca de e-mail exige senha atual.
- C-049 IP real do BFF e limite por conta sem bloqueio total.
- C-051 2FA obrigatório para super_admin/gerente.
- C-050 login só por e-mail (ou usuário único) e CNPJ pelo cadastro do provedor.

## Lote 2 — Serviço único de ciclo de vida da O.S. (a base da Fase 1)
Uma peça central que resolve ou destrava a maior parte dos achados altos de atendimento.
**Fazer antes de mexer em workflows, integrações e relatórios.**

- C-013 / C-035: `ServiceOrderLifecycle` (transições, aprovação, datas, auditoria, eventos, efeitos pós-fechamento, sincronização da ocorrência), usado por `transition`, `run`, motor v2, workflows e integrações.
- Resolvidos por ele: C-014 (datas na reabertura), C-039 (aprovação no fluxo), C-032 (CSAT no fechamento real), C-016 (conclusão conjunta atômica).
- Na criação: C-004 (sem status na abertura), C-010 (`afterOrderCreated` comum), C-007 (validação de membros única), C-006 (data retroativa).
- Prazo: C-005 (motivo + auditoria de SLA), C-025 (recalcular ao mudar tipo), C-017 (versão obrigatória).

## Lote 3 — Automação e integrações (depende do Lote 2)
- C-036 gatilhos de workflow (`os_critica`, `sla_breach`), C-037 ações pelo serviço único, C-038 idempotência do retry.
- C-034 modelos de processo de O.S. (laço e duplicidade) **ou** desativação, conforme a decisão D-2.
- C-009 catálogo só com fluxo publicado.
- C-043 chat (hoje sempre falha), C-044 Zabbix (deduplicação e recuperação), C-045 + C-066 IXC (webhook e reconciliação), C-067 gerador de protocolo único.
- C-033 mensagens de resolução/fechamento próprias.

## Lote 4 — SLA e alertas
- C-024 políticas por prioridade (decisão D-1), C-026 feriados independentes do fuso do servidor.
- C-027 percentual em horas úteis, C-028 idempotência por prazo vigente, C-029 provedor e horário certos nos alertas.
- C-030 pausa automática em "Aguardando" (decisão D-3).
- C-059 plantonista atual para alertas (decisão D-4).

## Lote 5 — Telas do atendimento e da gestão
- C-015 transições válidas na tela e escondidas em O.S. com processo; mensagens da API em português (C-080).
- C-011, C-012 abertura (ocorrências encerradas fora da lista; "trabalho já realizado" no topo).
- C-040, C-042 indicadores por id do analista; resolvidas × fechadas.
- C-022, C-041 limites de listagem.

## Lote 6 — Proteções e qualidade

> Continuação em 04/11: proteções e verificações implementadas no working tree; veja o registro
> em CORRECOES.md. C-072 (commits), partes de C-079/C-082/C-084 e implantação permanecem pendentes.
- C-054 cofre (motivo, reautenticação, limite, chave sem criação automática).
- C-055 SSRF (redirecionamento, IPv6), C-057 métricas, C-056 auditoria.
- C-023 anexos de O.S. (modelo dos relatórios de turno).
- C-079 trava nos scripts, C-072 commitar migrations e trabalho pendente.
- C-001, C-002, C-085 (typecheck, teste e avisos de lint); C-081 (integração com banco no CI) **antes do Lote 2**, para o serviço de ciclo de vida já nascer testado; C-082 acompanha cada lote.
- C-083 remover as cópias de front-end em `docs/`; C-084 divisão dos arquivos grandes (sai do Lote 2).

## Lote 7 — Modelo de dados e limpeza (pode ir em paralelo depois do Lote 2)

> Continuação em 04/11: implementadas proteções de agenda/notas/horas/RFC, histórico arquivado,
> retenção, índices, proteção contra cascatas, refresh e WebSocket. C-062/C-064/C-069/C-070
> permanecem parciais; C-018 aguarda D-5. Migration e implantação pendentes. Detalhes em CORRECOES.md.

- C-070 chaves em vez de texto (provedor, analista, setor, origem), C-008 `customerId` obrigatório.
- C-071 índices, C-073 limpeza de sessões, C-074 cascatas, C-068 auditoria arquivada visível.
- C-060, C-061, C-062, C-063, C-064, C-069, C-031, C-052, C-018 (decisão D-5).

## Decisões de negócio pendentes (antes do Lote 3)
| ID | Pergunta | Achados |
| --- | --- | --- |
| D-1 | ~~A prioridade muda o prazo do SLA?~~ **Decidido em 04/11: sim** (exceção do tipo → tipo → prioridade → NORMAL → 48 h) | C-024 |
| D-2 | **Decidido: processos v2 oficiais; workflows para efeitos.** Legado sem dados nesta instância, entradas de escrita desativadas. | C-034, C-035 |
| D-3 | ~~Aguardando pausa o SLA?~~ **Decidido em 04/11: só "Aguardando terceiros"** | C-030 |
| D-4 | ~~Plantão ou escala?~~ **Decidido em 04/11: cadastro de Plantão** | C-059 |
| D-5 | **Decidido: analistas podem colaborar sem assumir a O.S., com identificação no histórico.** | C-018 |
| D-6 | A data de abertura retroativa é necessária? Para quem? | C-006 |


### Fechamento adicional — 04/11/2026

Complementados lotes 1 (login, 2FA e limitação sem bloqueio global), 3 (retirada das entradas
legadas e restrição de workflows a efeitos), 7 (total de horas e paginação) e proteção local de
backup. D-2/D-5 decididas. C-035 segue parcial pela unificação transacional interna.
HTTPS e backup externo aguardam domínio/destino, ainda não disponíveis conforme o usuário.
Detalhes, validação e pendências atualizados em CORRECOES.md.

Lote 6 concluído em 05/11/2026: C-001, C-002, C-054, C-080 e C-040 fechados; C-086 (worker parado por exigir SMTP) encontrado e corrigido. Pendências que dependem do usuário: C-072 (commit), C-075 (domínio HTTPS), C-076 (destino do backup externo), C-078 (troca para o compose de produção).
