# Piloto executado: demandas reais do SGP e workflows próprios

Atualizado em 21/10/2026. Ambiente principal: porta 8070. O SGP foi apenas consultado: nenhuma O.S., ocorrência ou configuração foi alterada na origem. O IXC não foi usado como fonte de importação.

## Resultado e acesso

- [Workflows: editar modelos](http://168.194.13.18:8070/gerencia/workflows).
- [Processos: acompanhar os atendimentos](http://168.194.13.18:8070/gerencia/processos).
- [OLT Meganet: principal concluída, três filhas e progresso de 33%](http://168.194.13.18:8070/gerencia/processos/6317fb3d-ebcf-41fd-aeb0-0ddf176884f9).
- [DNS Meganet: diagnóstico na mesma O.S.](http://168.194.13.18:8070/gerencia/processos/f99d5d75-8617-4cc9-bfda-fc7612502376).
- [Ultranet: O.S. aberta de preparação de script, iniciada apenas na triagem](http://168.194.13.18:8070/gerencia/processos/27904ad1-046c-494d-b952-ece5b9660788).
- [Provedores em tabela](http://168.194.13.18:8070/gerencia/provedores).

Foram selecionadas **30 O.S., cinco por provedor**, com cinco tipos de origem diferentes em cada provedor. Uma O.S. já estava no piloto anterior; foram acrescentadas 29, sem duplicá-la. Foram preservados os vínculos com cliente/ocorrência, protocolos de origem, datas e 28 comentários de origem. Na leitura de origem havia 28 ordens encerradas e duas abertas. A importação não simula retroativamente etapas que não foram registradas no SGP.

As duas demonstrações são novas ocorrências e novas ordens identificadas como **DEMONSTRAÇÃO**. A OLT tem quatro ordens no total: principal e três filhas; o DNS tem uma. Os registros simulados não alteram o histórico importado, não enviam avisos externos e não entram nos indicadores contratuais de SLA. A conclusão técnica do backup na demonstração é fictícia e está explicitamente identificada como tal.

## A descoberta mais importante

O tipo no SGP não basta para escolher um workflow. O campo `tipo` da listagem de O.S. informa Interna/Externa; o rótulo da demanda vem da ocorrência. Mesmo esse rótulo é frequentemente amplo ou inadequado ao conteúdo.

Exemplos verificados na amostra:

- Homenet 8911, rotulada como configuração de OLT, era uma orientação sobre retificadora Huawei. Não deve gerar três ordens de implantação de equipamento.
- Meganet 11892, rotulada como migração, relatava clientes sem autenticar **depois** de uma migração feita pelo provedor. O fluxo adequado é diagnóstico/correção de autenticação.
- Infotel 11655, rotulada como BGP, pedia análise de capacidade de porta do IX. Não autoriza executar mudança de roteamento.
- Ultranet 11931 pede um **script** de migração. Elaborar e entregar o script não equivale a executar a migração em produção.
- DNS inclui verificação, implantação, segurança de recursivo e correção autoritativa: objetivos e evidências diferentes.

Por isso os oito rótulos de origem da amostra foram refinados em **19 modelos propostos**, com campos técnicos diferentes. Não é uma classificação automática validada para toda a empresa: os 30 registros têm enquadramento revisado e justificativa explícita; novos registros desconhecidos exigem revisão.

## Amostra e enquadramento proposto

Os números abaixo são IDs de O.S. **do SGP**, não números inventados de demonstração.

| Provedor | O.S. selecionadas e demanda identificada |
| --- | --- |
| Meganet, cliente 60 | 10873: configuração OLT; 11537: verificação DNS; 11568: mudança BGP/trânsito; 11926: configuração Zabbix/Grafana; 11892: diagnóstico de autenticação/quedas. |
| Homenet, cliente 108 | 8911: orientação sobre energia; 8205: verificação DNS IPv6; 11840: correção de coleta; 4597: migração PON/ONU; 11848: consulta de autorização ONU/ONT. |
| Ecotelecom, cliente 53 | 10610: diagnóstico de autenticação; 740: implantação DNS; 7237: migração ASN/BGP; 9539: cadastro de monitoramento; 7615: migração PON/ONU. |
| Infotel, cliente 89 | 11419: diagnóstico de quedas; 11174: segurança DNS recursivo; 11655: capacidade de enlace; 11633: cadastro de monitoramento; 10860: migração de equipamento. |
| Ultranet, cliente 25 | 11885: migração PON/ONU; 10521: correção DNS autoritativo; 11405: mudança BGP/trânsito; 11858: correção de alertas; 11931: preparação de script de migração. |
| G5 Jaboatão, cliente 9 | 11549: configuração OLT; 10881: lentidão/tráfego; 11854: correção de alertas; 10021: migração PON/ONU em lotes; 11834: indisponibilidade de site. |

A investigação consultou até 100 registros recentes por contrato, não todo o histórico. Foram encontradas 98/100/100/100/158/191 correspondências de O.S. com ocorrência, respectivamente nos seis provedores da tabela. Só os cinco registros fixados por provedor tiveram o detalhe solicitado para esta migração. Reexecutar o coletor não escolhe novas ordens automaticamente; se um registro sair da janela, ele falha e pede revisão.

## Comportamento entregue

**DNS e demandas diretas:** qualificação, diagnóstico, decisão, correção quando necessária e validação. As etapas usam a mesma O.S. Encaminhar troca o responsável, registra motivo e conserva protocolo. Orientações/consultas têm caminho mais curto; preparação de script exige revisão e entrega, sem tratar uma migração real como realizada.

**OLT e migrações que usam o modelo paralelo:** exigem plano/reversão e aprovação gerencial para mudanças. Após validação, a principal é fechada e três ordens independentes são geradas para monitoramento, documentação e backup. O processo só termina depois da conclusão de todas as filhas obrigatórias. Essa composição é uma **proposta operacional**, não uma afirmação de que toda migração PON precise dos três setores; o gestor pode ajustar/publicar o modelo antes de novas execuções.

O motor não executa configuração técnica em equipamentos, Grafana, DNS ou Backup Center. Ele distribui e acompanha o trabalho humano, exigindo registros de execução e validação.

Cada bloco define setor, perfis autorizados, responsável opcional, prazo proposto e evidências. Sem pessoa definida, a O.S. fica na fila do setor, identificada como tal. Os técnicos importados continuam com acesso bloqueado até a revisão de acesso; atribuir trabalho não libera login.

## Autoridade e compatibilidade: inventário explícito

| Mecanismo existente | Tratamento no piloto |
| --- | --- |
| Processos V1 (`state.current`) | Preservados para a única execução anterior da Meganet, O.S. 11926. Ela não foi reiniciada nem duplicada. A referência V2 aponta para o acompanhamento original. |
| `ServiceProcessTemplate` / `ServiceProcessInstance` | Reaproveitados com `engineVersion=2`, snapshot de definição por execução e novas tabelas de etapas, vínculos e eventos. |
| Workflows por evento | Continuam separados para ações pontuais. Eventos operacionais não permitem que esse motor crie ordens, feche ordens, altere atribuição ou dispare webhook genérico. Avisos/CSAT são extensões separadas, não autoridade do processo. |
| Templates legados de filhas | Preservados para ordens não gerenciadas. Ignoram O.S. vinculadas a um processo. O inventário do ambiente tinha zero templates e zero regras genéricas cadastradas; não havia regras reais a migrar/desativar. |
| Trilha de O.S. | Mantida como consulta de histórico/transições, não como outro editor de execução. |
| Cinco modelos genéricos iniciais substituídos | Arquivados para novas execuções; snapshots antigos continuam disponíveis. |
| 26 propostas iniciais com classificação genérica | Mantidas como `SUPERSEDED`, com motivo e link da sucessora. Só referências históricas ou triagem sem execução foram substituídas. Nenhum trabalho efetivamente realizado foi sobrescrito. |

Estado conferido após a preparação: um processo V1 ativo; 29 referências V2 históricas; três execuções V2 ativas (duas demonstrações e a triagem real da Ultranet); 26 propostas anteriores arquivadas. Há 19 modelos V2 publicados e cinco arquivados. Arquivamento não significa exclusão.

## Segurança de execução e falhas

- Chaves únicas no banco para raiz por tenant, O.S. por chave de trabalho da execução, etapa/tentativa e evento de fechamento. A mudança de estado, o fechamento e a geração de filhas ocorrem na mesma transação.
- Versão otimista por execução impede dois comandos concorrentes de aplicar o mesmo avanço. Conflitos pedem recarga; repetição não cria outras filhas.
- Etapas, evidências, dependências e eventos ficam no PostgreSQL. Reiniciar a API não depende de restaurar variáveis em memória.
- Falha inesperada reverte o comando, registra estado `FAILED` e permite retomada por gestor. Falhas de validação/permissão não avançam a execução. Falhas de automação pontual aparecem separadamente e podem ser reprocessadas.
- O consumidor de eventos usa reivindicação com prazo, até cinco tentativas e reprocessamento gerencial. **Avisos externos são entrega ao menos uma vez:** queda após envio e antes da confirmação pode repetir um aviso; não se promete exatamente uma vez em serviços externos.
- Cancelamento é distinto de sucesso. Reabertura por gestor reutiliza as ordens existentes e retoma a última etapa humana; não dispara novamente o bloco de geração. Auditoria registra motivo/ator.
- Limites do piloto: 60 blocos por definição; 120 transições automáticas por comando; 20 ordens por execução; derivadas em um nível; até dez visitas por bloco, cinco nos modelos gerados.
- Consultas e atribuições exigem o mesmo tenant, perfis permitidos e responsável da etapa; gestor pode atuar sobre a equipe. Textos importados passam por remoção de linhas reconhecíveis de credenciais e autenticação embutida em URLs. Não foram persistidos os campos de senha retornados pela API do SGP. Isso não substitui revisão humana de texto livre antes de uma migração ampla.

Foi criado o banco de recuperação `ajust_erp_workflow_backup_20261020` antes da alteração de esquema. A cópia de comparação da porta 8071 usa outro banco e não recebe as O.S. deste piloto.

## Limites que não devem ser confundidos com entrega completa

O editor e a execução funcionam para o piloto, mas não são um motor BPMN completo nem uma reprodução de todo o Lucidchart. A junção atual exige tarefas abertas diretamente pelo mesmo bloco paralelo; subfluxos aninhados, junções opcionais dinâmicas, temporizadores de negócio, compensações automáticas e migração de uma execução trabalhada para outra versão ainda não são suportados.

A associação de novos atendimentos é explícita na O.S.: escolhe-se o modelo publicado. Não foi criado um vínculo novo de catálogo com seleção automática por serviço/provedor; a taxonomia precisa ser aprovada antes de automatizar essa escolha. Não existe autorização para migrar outras ordens fora das 30 fixadas.

Os prazos de blocos são **metas propostas em minutos corridos**, com deslocamento durante pausa do processo inteiro. Ainda não representam políticas contratuais nem o calendário útil do SLA do ERP. Histórico importado e ordens do piloto usam `slaEligible=false`. Política contratual, calendários por serviço e pausa de ramo isolado precisam de homologação/integração antes da operação definitiva.

## Reprodução e evidências

1. Aplicar a migration `20261020213000_operational_workflow_execution` e regenerar Prisma, após backup.
2. Executar `scripts/import-sgp-sample.ts --apply` com `SGP_TOKEN` somente no ambiente e o `.env` do banco apropriado. O script sem `--apply` apenas planeja.
3. Executar `scripts/seed-workflow-demonstrations.ts` com `TSX_TSCONFIG_PATH=apps/api/tsconfig.json`. Os IDs das demonstrações são reutilizados; o script é para preparar **este estado** de apresentação, não para reverter ações posteriores dos gestores.
4. `scripts/check-workflow-ui.cjs` recebe `ERP_UI_LOGIN` e `ERP_UI_PASSWORD` no ambiente; verifica navegador real, progresso 33%, simulação sem ordens e seis provedores em tabela.

Verificação final: **389 testes da suíte geral aprovados** (11 condicionados a banco/ambiente ficaram desabilitados nessa execução); execução adicional explícita de **10 testes com banco**, cobrindo processos V1/V2, aprovada. Typecheck da API, do frontend principal e da cópia visual aprovado; lint dos novos módulos sem erros. Navegador real conferiu a OLT com 33%, a simulação e os seis provedores em tabela na porta 8070, sem erros de página/API; também conferiu seis linhas na tabela da porta 8071, sem erros de página. Nova importação reutilizou as 30 ordens, sem novas ordens nem casos pendentes de revisão.

Testes cobrem DNS em uma ordem, validação de evidências e grafos, isolamento de tenant, concorrência/versões, OLT em paralelo, cancelamento, reabertura sem duplicação, falha com rollback e retomada gerencial, preservação de snapshots, bloqueio do gerador legado em ordens gerenciadas, classificação e sanitização. Os testes de banco usam transação revertida, sem deixar fixtures no cadastro. Verificação manual do estado demonstrativo incluiu dois comandos simultâneos para a mesma etapa: um aplicado e outro recusado por conflito.

Arquivos centrais: `operational-definition.ts`, `operational-processes.service.ts`, `operational-processes.controller.ts`, `sample-classification.ts`, `import-sgp-sample.ts` em `apps/api/src/service-processes/`; `operational-workflows.tsx` e `operational-flow-graph.tsx` no frontend; esquema/migration Prisma.
