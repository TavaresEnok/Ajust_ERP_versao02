# Revisão das análises de ocorrências/O.S. e viabilidade de migração

Data: 20/10/2026. Escopo: cliente SGP 60, contrato 80 (Meganet), documentação local e código do Ajust ERP. Operações realizadas: consultas de leitura ao SGP e inspeção local. Não foi executado importador nem feita alteração no banco ou no SGP.

## Parecer sobre as análises anteriores

A Luna acertou a necessidade de preservar identificadores, comentários, datas, estados de origem e evitar duplicatas. Entretanto, a cobertura do levantamento estava errada: os endpoints usados anteriormente retornaram uma parte do histórico. A Terra reproduziu essa limitação. Não é correto considerar as três ocorrências e uma ordem como todo o histórico ou como as três ocorrências mais recentes do contrato.

Também é impreciso afirmar que o banco do ERP exige ocorrência com O.S. O modelo permite zero ou várias ordens; quem exige a primeira ordem é o fluxo de criação da API. Uma rotina específica de migração pode preservar os registros históricos sem mudar a regra de abertura dos novos atendimentos.

A afirmação de que o ERP é superior ao SGP também excede a evidência disponível. O código mostra recursos compatíveis com as necessidades da consultoria, mas esta revisão não comprova a qualidade operacional de todas as telas, relatórios ou regras de SLA em produção.

## 1. Dados efetivamente conferidos no SGP

Foi usada a autenticação que já havia funcionado, com o app `Sistema_de_O.S`. Segredos de autenticação e credenciais dos serviços não foram incluídos neste documento.

| Consulta | Filtro | Resultado observado |
| --- | --- | --- |
| `/api/central/chamado/list/` | `cliente=60` | Três registros: IDs 10443, 11817 e 11990. |
| `/api/ura/ocorrencia/list/` | `contrato=80`, `offset=0`, `limit=1000` | `total=426`, `parcial=426`; 426 registros recebidos. |
| `/api/ura/ordemservico/list/` | Mesmo contrato e paginação | `total=424`, `parcial=424`; 424 registros recebidos. |
| `/api/os/list/id/{id}` | IDs 11926, 11892 e 11758 | Detalhes das três ordens recentes, todas confirmando `cliente_id=60` e `contrato_id=80`. |

Nas duas listagens URA completas, todos os registros identificam contrato 80 e cliente Ariele Kethilin J Silva (Meganet). Foram conferidos:

- 426 ocorrências: uma aberta e 425 encerradas.
- 424 O.S.: uma aberta e 423 encerradas.
- Todas as O.S. apontam para um protocolo de ocorrência existente na listagem.
- Nenhuma ocorrência desse conjunto possui mais de uma O.S. no cruzamento recebido.
- Duas ocorrências não têm O.S.: IDs 11817 e 10443. Isso confirma a existência desses casos, mas eles são exceção no histórico lido.

Os totais referem-se a esse contrato e às permissões da credencial. Não representam um inventário de todos os contratos do cliente ou da empresa. A causa exata da diferença de cobertura entre Central e URA não foi estabelecida; não se deve atribuí-la a um filtro específico sem comprovação. Para a migração, a conferência de paginação e totais é obrigatória.

### Ocorrências recentes que o primeiro levantamento não cobriu corretamente

| Ocorrência | Data | Tipo | Estado | O.S. |
| --- | --- | --- | --- | --- |
| ID 11990 · `261019175100` | 19/10/2026 | Configuração Zabbix/Grafana | Aberta | 11926 · Vitor Andrade |
| ID 11954 · `261015171400` | 15/10/2026 | Migração de equipamento | Encerrada | 11892 · Rennan Monteiro |
| ID 11818 · `260930180700` | 30/09/2026 | Informações | Encerrada | 11758 · Maverick Martins |
| ID 11817 · `260930175900` | 30/09/2026 | Informações | Encerrada | Sem O.S. |

A ocorrência de junho apresentada antes não era a terceira mais recente. Há ainda duas solicitações semelhantes de formulário em 30/09: IDs 11817 e 11818, apenas uma com O.S. Mesmo com textos parecidos, são identidades distintas e não devem ser fundidas automaticamente pela descrição.

### O que os detalhes das três O.S. mostram

- **11926:** aberta, prioridade 2, corretiva, responsável Vitor Andrade. Setor, serviço prestado e observação vazios. Tem dois comentários, um deles com relatório técnico extenso em HTML sobre alterações no Zabbix. O agendamento não está confirmado. A data de agendamento aparece antes da criação por alguns segundos; isso não comprova atraso nem compromisso efetivo.
- **11892:** encerrada, prioridade 2, responsável Rennan Monteiro, setor CGR. Criada em 15/10 às 17:15:59 e finalizada às 17:20:00, conforme valores sem offset retornados pelo SGP. Tem um comentário. Serviço prestado e observação também vazios.
- **11758:** encerrada, prioridade 2, responsável Maverick Martins, setor CGR. Criada em 30/09 às 18:10:24 e finalizada em 01/10 às 12:07:14. Sem comentários no detalhe recebido; serviço prestado e observação vazios.

Os campos de execução vazios não provam falta de trabalho: a ordem 11926 tem relatório nos comentários. Tampouco um relatório prova que a ordem deva ser fechada automaticamente. Para acompanhamento gerencial, a empresa deve definir como registrar solução, pendência, validação e encerramento de modo consistente.

## 2. O que adaptar para a migração

### Banco e criação de ocorrências

Em [`schema.prisma`](../../prisma/schema.prisma), `Occurrence.serviceOrders` é uma coleção sem exigência de quantidade mínima. Em [`service-orders.controller.ts`](../../apps/api/src/service-orders/service-orders.controller.ts), `CreateOccurrenceSchema` exige `firstOrder`. Portanto:

- A Luna está correta sobre a limitação da API atual.
- Não é necessário alterar a cardinalidade do banco para importar as duas ocorrências sem ordem.
- A alternativa recomendada é um caminho administrativo de importação histórica. Alterar a abertura normal para permitir ocorrência sem ordem é uma decisão de produto separada.

### Identidade e vínculo com o provedor

O ERP já relaciona ocorrência e O.S. a `Tenant`; não existe apenas um nome livre de provedor. O campo `Occurrence.provider` é texto, mas o isolamento e parte das telas usam `tenantId`. O detalhe do provedor em [`people-pages.tsx`](../../apps/web/components/erp/people-pages.tsx) filtra ordens pelo tenant.

É necessário definir o vínculo cliente SGP 60/contrato 80 → tenant correto do ERP. Somente preencher `provider="Meganet"` em um tenant genérico pode deixar registros fora da visão esperada do provedor. A arquitetura de acesso de gestores e técnicos a múltiplos tenants precisa ser respeitada.

`ServiceOrder` já possui `sourceSystem=SGP` e `externalProtocol` único por tenant. Isso ajuda, mas não resolve sozinho o mapeamento dos IDs numéricos de ocorrência, ordem e comentário, nem a possibilidade de várias ordens numa ocorrência. Na amostra, protocolo da O.S. e número da ocorrência coincidem; o ID numérico da ordem deve compor a identidade de importação para não presumir que essa coincidência sempre distingue ordens.

Uma tabela de correspondência de origem pode guardar instância SGP, entidade, ID externo, ID interno, protocolo, data de leitura e resultado da importação. Ela é uma opção ao acréscimo de vários campos nas tabelas operacionais. Comentários também precisam de chave externa própria para não se duplicarem em uma segunda execução.

### Datas, origem e efeitos da API operacional

O fluxo atual em [`service-orders.service.ts`](../../apps/api/src/service-orders/service-orders.service.ts):

- Gera novo protocolo e marca a origem da ordem como ERP.
- Permite data histórica para a ocorrência, mas cria a primeira O.S. com a data padrão atual.
- Calcula o SLA a partir de `now` quando nenhum prazo é informado.
- Gera evento de criação e publica eventos para outros consumidores.

Logo, usar esse fluxo sem adaptação pode registrar uma ocorrência antiga com O.S. aparentemente nova, origem incorreta e prazo calculado no dia da migração. Alterações de status pela operação normal também usam a hora atual para fechamento e resolução. O importador deve preservar datas reais, autor de origem e proveniência, sem inventar transições históricas.

Os retornos SGP misturam datas brasileiras e ISO sem offset. É necessário confirmar o fuso configurado no SGP, interpretar explicitamente esse fuso e persistir instantes consistentes. O fuso da conversa não comprova o fuso da base SGP.

### SLA: há uma restrição concreta a resolver

`ServiceOrder.deadlineAt` é obrigatório no banco. Os detalhes lidos não trouxeram o prazo contratual histórico de SLA. A recomendação anterior de não recalcular o passado é correta, mas incompleta: será necessário decidir como representar essa ausência com o modelo atual.

Não se deve inventar um prazo de 24/48 horas e apresentar cumprimento histórico de SLA como fato. As opções incluem guardar a condição de prazo desconhecido com exclusão explícita desses registros dos indicadores, ou ajustar o modelo e os relatórios para suportar ausência de prazo histórico. Isso exige implementação antes de apresentar indicadores confiáveis do passado.

Para a ordem aberta, é preciso definir a regra de transição: continuar um prazo anterior verificável ou estabelecer um novo compromisso documentado. Conservar a data de abertura real é indispensável. O monitor atual inclui ordens em espera entre as ordens avaliadas; um estado “aguardando” não comprova pausa automática do SLA.

### Status, tipos, responsáveis e conteúdo

| Campo | Tratamento recomendado |
| --- | --- |
| Status da ocorrência | Os quatro estados locais se aproximam dos estados documentados do SGP; mapear códigos explicitamente. |
| Status da O.S. | Aberta → ABERTA e Encerrada → FECHADA são candidatos coerentes. A amostra completa só confirma esses dois estados; Execução e Pendente precisam de regra de operação antes de usar EM_ANALISE ou qualquer espera específica. Preservar valor original. |
| Tipo e motivo | “Migração de equipamento”, “Zabbix/Grafana” e “Corretiva” representam dimensões distintas. O enum local não contém todos os tipos externos. Usar tabela de equivalência revisada, conservando o texto/código original. |
| Prioridade | Preservar a prioridade estruturada do SGP e mapear seus códigos. Não aumentar prioridade com base em palavras da descrição sem uma regra deliberada. |
| Técnico e autor | Resolver identidades com o usuário/login de origem e tenant. Preservar nome histórico quando não houver correspondência, sem criar contas ativas automaticamente. |
| Comentários | Preservar ID externo, autor e data. O SGP retorna HTML e a tela local analisada exibe a mensagem como texto; preparar conversão que mantenha parágrafos e comandos ou renderização sanitizada. |
| Visibilidade | Definir se comentários, anexos e notas serão internos ou visíveis ao cliente. Os modelos de notas habilitam visibilidade ao cliente como padrão; importar tudo sem regra pode expor conteúdo interno. |
| Campos ausentes | `sector`, `openedByName` e `analystResponsible` são obrigatórios no cadastro de ocorrência. Se a fonte não os fornecer, representar desconhecimento de forma explícita; não atribuir ao técnico dados de autoria que a fonte não comprova. |

Agendamento é diferente de prazo de SLA. Anexos, checklist, assinaturas e histórico completo de mudanças não foram integralmente levantados nesta revisão; devem ser incluídos por necessidade, com consultas próprias e preservação de metadados. Também não se pode inferir que todos os comentários de ocorrência sejam idênticos aos comentários da O.S.

### Existe um importador piloto, mas ele não é uma migração final pronta

[`import-hub-real-pilot.cjs`](../../scripts/import-hub-real-pilot.cjs) lê backup SQL de outro Hub, não esta API SGP diretamente. O script, com a configuração padrão, apaga O.S. e ocorrências do tenant alvo antes de inserir dados. Também infere prioridade/tipo por palavras, associa cada ordem a uma ocorrência criada e usa prazo de um dia quando não há prazo na fonte.

Essas escolhas podem servir a uma carga demonstrativa específica, mas não preservam fielmente o histórico SGP. O script foi apenas lido, não executado. Seu reaproveitamento exigiria revisão de escopo, identidade, autoria, prazos, visibilidade e reexecução sem exclusões.

## Viabilidade e comparação dos sistemas

Para o contrato lido, o volume de 426 ocorrências e 424 ordens é administrável. A maior dificuldade está na representação correta e na leitura de todos os endpoints necessários. Classifico a migração fiel como trabalho de complexidade moderada, não uma importação direta pela API operacional atual.

O ERP tem recursos no código que parecem adequados à consultoria: políticas de SLA, calendário útil, responsáveis, estados de espera e auditoria. O SGP já armazena um histórico significativo dos atendimentos reais da consultoria. Não há evidência suficiente nesta revisão para declarar um vencedor geral ou afirmar que o SGP não tem SLA: ausência de um campo nas respostas consultadas não equivale à ausência da função no produto.

A recomendação é uma migração seletiva com simulação prévia: resolver o tenant, obter os registros com paginação conferida, mapear identidades e campos, importar sem disparar efeitos indevidos e conferir contagens e vínculos. Uma segunda execução deve produzir zero duplicatas. Para apresentação, começar por uma amostra recente que inclua uma O.S. aberta, uma encerrada com comentário e uma ocorrência sem O.S., deixando os dados históricos sem SLA verificável identificados como tal.

## O que foi verificado e o que permanece em aberto

Foi conferida a leitura completa das duas listagens do contrato 80, seus totais, nomes de cliente, vínculos por protocolo e detalhes de três ordens recentes. Foram inspecionados schema, validações e criação de ocorrência/O.S., importador piloto, monitor de SLA e pontos de exibição de provedor e comentários.

Não foram executados testes do ERP nem carga de dados; não foram avaliados todos os módulos em produção. Fuso do SGP, política histórica de SLA, equivalências dos estados não observados, catálogo completo e escopo de anexos/comentários de ocorrência permanecem decisões ou levantamentos pendentes.
