# Fluxos de O.S.: diagnóstico do ERP e desenho proposto

> Atualização de 21/10/2026: a especificação abaixo registra o diagnóstico **anterior** à implementação. O piloto executável, o inventário de compatibilidade, os registros importados e os limites atuais estão em [piloto-workflows-executado.md](piloto-workflows-executado.md). O editor entregue está descrito em [editor-operacional.md](editor-operacional.md). Não interpretar as lacunas históricas desta análise como estado atual do código.

Data: 20/10/2026. Base: código do checkout atual do Ajust ERP e exemplos de OLT/DNS fornecidos pelo usuário. Esta é uma análise com especificação de implementação; o motor, as telas e os dados operacionais não foram alterados neste trabalho. A disponibilidade de cada recurso foi avaliada por inspeção do código, sem certificar uma execução completa em produção.

## 1. Parecer

O comportamento solicitado é adequado para a consultoria e é viável no ERP: cada serviço seleciona um fluxo; esse fluxo pode conduzir uma única O.S., criar O.S. derivadas, executar ramos em paralelo e esperar sua conclusão. A O.S. principal e o fluxo têm estados independentes. Concluir a configuração da OLT libera o analista; o processo continua em andamento enquanto monitoramento, documentação e backup executam seus trabalhos.

Hoje há componentes reaproveitáveis, mas nenhum dos mecanismos existentes executa todo esse comportamento. O trabalho necessário abrange persistência, motor de execução, vínculo com o catálogo e telas. Acrescentar somente três blocos no editor existente produziria uma representação visual que não garante as dependências operacionais esperadas.

## 2. O que são as três telas atuais

| Endereço | Função observada no código atual | Limite para o caso solicitado |
| --- | --- | --- |
| `/gerencia/trilha-os` | Histórico da O.S. selecionada e relatório agregado das transições entre estados. | Mostra o que aconteceu; não define o próximo trabalho nem representa a árvore de O.S. mãe/filhas. |
| `/gerencia/processos` | Processo de atendimento com modelo versionado, evidências, decisões, esperas e uma etapa ativa por execução. Inclui acesso aos templates legados. | O estado tem um único `current`. Cada nó `task` gera uma O.S.; portanto, não representa três trabalhos ativos em paralelo nem várias etapas internas da mesma O.S. |
| `/gerencia/workflows` | Cadastro/editor de regras com gatilhos de criação, atualização, fechamento e violação de SLA; condições e ações automáticas. | Executa o grafo durante o tratamento do evento. Não persiste tarefas humanas pendentes para retomar dias depois, quando as filhas terminarem. |

Há ainda um quarto mecanismo, acessível pelo botão **Templates legados** de processos: `OsProcessTemplate`. Ao fechar uma O.S. de determinado tipo, ele cria uma lista fixa de O.S. filhas. É o recurso mais próximo da primeira metade do exemplo OLT, mas sem execução durável das dependências e sem relação formal mãe/filhas no banco.

As três telas têm objetivos que podem coexistir. A confusão está na sobreposição de edição e execução e nas descrições semelhantes dos menus.

## 3. Organização recomendada

- **Gestão → Workflows:** lugar único para criar, revisar e publicar o fluxo de cada serviço. Editor visual com versões e campos obrigatórios. Pode ter uma aba separada para automações gerais, como avisos de SLA.
- **Operações → Processos de atendimento:** lugar para acompanhar execuções reais, ver responsáveis, O.S. vinculadas, ramos abertos, prazos e progresso. A edição do modelo deve direcionar para Workflows.
- **Histórico da O.S. / relatórios:** a trilha continua como consulta, identificada como histórico e transições. A página atual pode ser preservada por compatibilidade e deixar de parecer um terceiro editor de fluxos.

Os endereços podem ser preservados. O objetivo é ter uma definição de fluxo e uma autoridade de execução por atendimento, com perspectivas diferentes para configuração, acompanhamento e histórico.

## 4. Conceitos que precisam estar separados

| Conceito | Exemplo | O que registra |
| --- | --- | --- |
| Ocorrência/demanda | Implantação de uma OLT da Meganet | Contexto do atendimento e agrupamento do trabalho. |
| O.S. | Configurar a OLT | Responsável, setor, diagnóstico, resultado, estado e prazo próprios. |
| Etapa interna | Configurar, testar, corrigir, validar | Atividade dentro da mesma O.S.; não cria outra ordem por padrão. |
| Modelo de workflow | Configuração de OLT, versão publicada | Regras, decisões, criação de ordens, dependências e critérios de conclusão. |
| Execução do workflow | Fluxo iniciado pela OS-1042 | Versão usada, etapas executadas/ativas, O.S. geradas, eventos e progresso. |

Um nó deve declarar explicitamente se trabalha na **O.S. atual** ou se **cria uma nova O.S.**. Trocar o responsável da ordem atual também precisa ser uma ação própria. Encaminhar um DNS para outro analista deve manter protocolo e histórico.

## 5. Comportamento esperado: configuração de OLT

1. Abrir a OS-1042 com o serviço **Configuração de OLT**. Vincular a execução a uma versão publicada desse serviço.
2. O analista executa as etapas internas e registra evidências da configuração e dos testes.
3. **Configuração inválida:** retornar à correção na mesma O.S.; não gerar filhas.
4. **Configuração validada e O.S. fechada:** registrar o fechamento e disparar, uma única vez por execução, três ordens vinculadas: Grafana, diagrama e Backup Center.
5. Cada filha recebe setor, responsável quando definido e prazo próprios. O cliente/contexto acompanha a demanda; o setor deve vir da regra da filha.
6. Os três trabalhos podem ser executados simultaneamente, sem reabrir a O.S. principal. Se houver uma dependência expressa, somente o ramo dependente aguarda.
7. O coordenador consulta a execução: **principal concluída; processo em andamento; 1 de 3 filhas concluídas, 33%**.
8. A junção aguarda a conclusão de todas as filhas obrigatórias ativadas naquele conjunto. Depois conclui o processo ou libera uma auditoria, se o modelo exigir.

O percentual do exemplo é **progresso das três filhas**, não das quatro ordens nem de todos os blocos do desenho. Etapas opcionais não ativadas não entram no cálculo. Se novas filhas forem geradas posteriormente, a interface deve atualizar o total e explicar a mudança; não prometer um percentual global fixo antes de conhecer os ramos ativados.

Uma filha cancelada não equivale automaticamente a trabalho concluído. Dispensa exige regra explícita e justificativa; a interface deve distinguir conclusão, cancelamento e dispensa. A ocorrência só deve ser encerrada quando o trabalho obrigatório de seu escopo estiver resolvido e não houver outros processos/trabalhos ativos que impeçam o encerramento.

## 6. Comportamento esperado: verificação de DNS

1. Abrir uma única O.S. de **Verificação de DNS**.
2. Registrar diagnóstico e responder de forma estruturada: encontrou erro?
3. **Não:** registrar DNS validado e evidências; concluir a mesma ordem.
4. **Sim e resolvido:** registrar correção, testes e resultado; concluir a mesma ordem.
5. **Sim e não resolvido:** encaminhar a mesma O.S. para outro analista ou setor, com motivo e histórico, mantendo o protocolo. O ramo permanece aberto até a solução ou outra decisão permitida.

Esse fluxo não gera O.S. derivadas. Seu progresso deve apresentar as etapas da própria ordem; o indicador de filhas deve aparecer como não aplicável, sem mostrar divisão por zero ou 0% após a conclusão.

## 7. Lacunas concretas encontradas

### Processo de atendimento nativo

- `ProcessState.current` aceita uma visita por vez. `routes` seleciona um destino por resultado; não existe divisão paralela com várias visitas ativas.
- `activate()` cria uma O.S. para cada nó `task`. Isso transformaria diagnóstico, correção e validação de DNS em ordens distintas, contrariando o exemplo.
- `start()` exige seleção explícita do modelo; `sourceTypes` não é um vínculo automático entre o catálogo e a O.S.
- O modelo restringe o SLA a `PILOT_PROPOSED`; as ordens geradas têm `slaEligible=false`. Os prazos do piloto não são o SLA operacional definitivo.
- A conclusão de etapas fecha a O.S. diretamente pelo serviço de processos; ela não chama o mesmo caminho de eventos de fechamento do serviço comum de O.S.
- As ordens com `processInstanceId` têm suas transições comuns bloqueadas e devem ser concluídas pela tela de processos. Para o novo desenho, o analista precisa conseguir trabalhar pela O.S., e o processo deve receber essa conclusão.

São reaproveitáveis: versão imutável copiada para a execução, validação de evidências, controle de concorrência, histórico de visitas, permissões e base visual por setores.

### Workflows de automação

- `executeGraph()` usa fila e tokens em memória durante uma chamada. A junção paralela reúne as ações desse evento; concluir a ação de criar uma O.S. não significa concluir o trabalho dessa O.S.
- Os resultados das ações são registrados, mas não há uma execução durável que aguarde as três filhas e retome o grafo quando elas fecharem.
- A ação `task_service` cria uma ordem e registra referências em texto/tags. `team` entra na descrição; o campo `sector` é herdado da ordem de origem, em vez de usar a equipe configurada como destino operacional.
- Os eventos comuns de O.S. carregam um conjunto limitado de campos. Diagnóstico, resultado de validação e aprovação precisam fazer parte de um contrato estruturado para que uma condição seja confiável.
- Existe gatilho de fechamento, mas a ação automática de fechar O.S. grava diretamente no banco; diferentes caminhos de fechamento precisam ter o mesmo contrato de eventos.

São reaproveitáveis: editor de blocos, representação de conexões, formulários, condições, catálogo de ações, histórico de versões e auditoria de automações.

### Templates legados e rastreabilidade

- `OsProcessTemplate` cria uma lista fixa ao fechar uma ordem do tipo configurado. Não avalia o resultado técnico da configuração, nem representa esperas e bifurcações humanas.
- `ServiceOrder` não possui relação `parentOrderId`/`rootOrderId`. Compartilhar `occurrenceId` agrupa a demanda, mas não informa qual ordem gerou qual filha.
- O fechamento comum dispara **workflows e templates legados**. Se ambos forem configurados para o mesmo caso, podem criar trabalho equivalente em duplicidade.
- Não há chave única de geração por etapa/evento de origem. Reabertura, repetição e retomada após falha precisam de idempotência.
- A criação das filhas pelo template ocorre uma a uma, com captura de erro por filha. Pode haver geração parcial sem uma pendência operacional durável para reprocessamento.

### Catálogo e cliente

- `ServiceOrder.type` é uma enumeração ampla. OLT, monitoramento, documentação e backup não são identidades de serviço detalhadas nessa enumeração.
- O catálogo tem itens com nome, categoria e checklist, mas a O.S. não possui uma relação dedicada `serviceCatalogItemId`. Uma categoria como `DNS` não distingue **Verificação de DNS** de **Implantação de DNS**.
- O contexto do provedor da ocorrência é texto; não há relação dedicada com o cadastro `Customer`. Ao consolidar a criação de atendimentos, esse vínculo deve garantir que principal e filhas se refiram ao mesmo cliente de forma estável.

## 8. Evolução técnica proposta

### Persistência

Evoluir o modelo de processos existente, preservando as execuções do piloto com sua versão antiga. Evitar introduzir um quarto motor de O.S.

| Elemento proposto | Finalidade |
| --- | --- |
| Serviço de catálogo vinculado à O.S. | Selecionar o fluxo exato; categoria ampla continua útil para classificação. |
| Modelo/versionamento de workflow de atendimento | Separar rascunho e publicação; selecionar por serviço e, quando necessário, por provedor, com precedência explícita e uma versão aplicável. |
| Execução de processo vinculada à raiz | Guardar contexto, versão publicada, estado, início e conclusão independentemente do estado da principal. |
| Instâncias de etapa persistidas | Representar várias etapas ativas/aguardando, tentativas, evidências e qual O.S. cada etapa usa; substituir a dependência exclusiva de `state.current`. |
| Relações mãe/raiz nas O.S. | Consultar árvore de ordens e geração em vários níveis sem interpretar textos. Validar mesmo tenant e impedir ciclos. |
| Dependências/chegadas de ramos persistidas | Esperar todas as entradas obrigatórias ativadas; ramos de decisões exclusivas não percorridos não bloqueiam a junção. |
| Evento durável e registro de ação idempotente | Retomar após reinício e repetir tentativas sem criar ordens duplicadas. |

A restrição atual de uma execução por ocorrência precisa ser revista se uma mesma demanda puder conter fluxos independentes. Uma O.S. derivada pode ter seu próprio subfluxo, com vínculo explícito à execução principal e proteção contra recursão; não deve iniciar regras indiscriminadamente pelo simples fato de ter sido criada.

### Motor

Blocos mínimos: início/evento; etapa na O.S. atual; decisão com resultado estruturado; encaminhar mesma O.S.; criar O.S. vinculada; dividir ramos; aguardar conclusão de O.S.; reunir ramos; espera; concluir fluxo; notificar responsável.

A criação de O.S. e suas transições devem passar por um caminho de domínio comum. O fechamento e o evento pendente de processamento devem ser registrados na mesma transação. Um consumidor pode então ativar os próximos ramos, registrar cada ação com chave única e repetir somente ações ainda não concluídas. A chave precisa identificar execução, etapa, tentativa e origem; não apenas o tipo da O.S.

O processo só progride depois das confirmações duráveis esperadas. Criar uma ordem libera trabalho para pessoas; esse ato não satisfaz a dependência de que o trabalho tenha sido concluído. Falhas devem aparecer ao coordenador e permitir nova tentativa controlada. Reabrir uma principal exige uma regra de nova iteração, correção ou retomada; não deve recriar silenciosamente as filhas existentes.

SLA permanece por O.S., com política e calendário do ERP. Espera e pausa devem ter regras próprias; pausar um ramo não pausa automaticamente os outros. Uma meta global da demanda é um indicador separado e não a soma simples dos SLAs de trabalhos em paralelo. Os valores ainda precisam ser definidos para os serviços reais; as metas do piloto não devem ser promovidas silenciosamente a prazos contratuais.

### Interface

- No editor: distinguir visualmente **etapa da O.S. atual** de **nova O.S.**, configurar condições, equipe/responsável, evidências, prazos, paralelismo e junções.
- Na abertura: escolher serviço e mostrar qual fluxo publicado será usado; permitir um fluxo simples sem filhas. Evitar escolher manualmente entre mecanismos técnicos diferentes.
- Na O.S.: executar suas etapas e registrar conclusão/encaminhamento; mostrar origem, principal, derivadas e link da execução.
- No acompanhamento: principal concluída ao lado de processo em execução, cartões de filhas com setor/responsável/prazo, progresso do conjunto e pendências.
- Na trilha: eventos reais por ordem e por execução; diferenciar o grafo definido do caminho efetivamente percorrido.

## 9. Sequência recomendada de implementação

1. Consolidar o contrato de execução e a associação serviço → fluxo; preservar e identificar a versão antiga do piloto.
2. Criar as relações formais das ordens, instâncias de etapa e eventos duráveis com deduplicação. Definir autoridade única de geração por fluxo para impedir concorrência entre templates legados e workflows novos.
3. Entregar **Verificação de DNS**, com etapas na mesma ordem, resultados obrigatórios e encaminhamento sem gerar outra O.S.
4. Entregar **Configuração de OLT**, com fechamento validado da principal, três filhas paralelas e junção por conclusão real.
5. Unificar a edição em Workflows, organizar a tela de acompanhamento e esclarecer a trilha de histórico. Desativar/migrar regras legadas caso a caso, preservando rastreabilidade.
6. Validar os dois fluxos no piloto Meganet antes de expandir tipos de atendimento ou importar novas O.S.

### Critérios de aceite indispensáveis

- DNS completo, com ou sem erro corrigido, mantém uma única O.S.; encaminhamento conserva o protocolo.
- OLT sem validação não gera filhas. Fechamento validado gera exatamente três.
- Repetição do evento, concorrência e reinício do serviço não geram duplicatas nem perdem o andamento.
- Principal fechada não encerra antecipadamente o processo; cada filha pode ter estado, responsável e prazo diferentes.
- Uma filha concluída exibe 1/3 e 33%; três obrigatórias concluídas liberam a junção.
- Ramos não ativados não bloqueiam a conclusão; cancelamentos não simulam sucesso.
- Alterar/publicar um modelo não modifica o comportamento das execuções já iniciadas.
- Todos os caminhos de fechamento relevantes emitem o mesmo evento, incluindo execução pelo processo e fechamento automático.
- Cliente, permissões e isolamento por tenant são preservados em cada geração e encaminhamento.
- Falha de geração parcial fica visível e sua retomada cria somente as ordens faltantes.

## 10. Fontes no repositório

- `apps/web/components/erp/workspace.tsx`: rotas efetivas das três páginas.
- `apps/web/components/erp/operational-pages.tsx`, `reports-workspace.tsx` e `report-flow-graph.tsx`: histórico e relatório de transições.
- `apps/web/components/erp/service-processes.tsx` e `service-process-graph.tsx`: configuração e acompanhamento do piloto.
- `apps/api/src/service-processes/process-definition.ts` e `service-processes.service.ts`: estado de uma etapa, geração de O.S. por tarefa e conclusão do processo.
- `apps/api/src/workflows/workflows.service.ts` e `action-executor.service.ts`: execução por evento, paralelismo em memória e ações automáticas.
- `apps/api/src/os-process-templates/os-process-templates.service.ts`: geração por lista fixa no fechamento.
- `apps/api/src/service-orders/service-orders.service.ts`: criação/transições e disparo simultâneo dos mecanismos existentes.
- `apps/api/src/reports/reports.service.ts`: agregação de transições observadas.
- `apps/api/src/service-catalog/service-catalog.service.ts` e `prisma/schema.prisma`: catálogo, tipos, vínculos e restrições de persistência.
