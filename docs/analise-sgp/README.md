# Análise inicial: SGP × Ajust ERP (ocorrências e O.S.)

> **Perfis atuais, 21/10/2026:** [somente Super Admin, Gerente, Analista e Cliente; Técnico/Leitura removidos e 39 vínculos migrados](consolidacao-perfis-2026-10-21.md).

> **Acessos e experiência, 21/10/2026:** [três perfis de avaliação, portal Meganet isolado dentro da Ajust e notas com editor lateral premium](acessos-gestores-e-notas-2026-10-21.md).

> **Auditoria atual, 21/10/2026:** [tipos de serviço e provedores, 41 rotas verificadas, dados disponíveis e bloqueios de produção](auditoria-gestores-e-producao-2026-10-21.md).

> **Ampliação atual, 21/10/2026:** [120 O.S., equipe, acessos reais, comentários, agenda e pendências documentadas da origem](ampliacao-real-20-os.md).

> **Entrega atual, 21/10/2026:** [piloto executável com 30 O.S., 19 workflows propostos, demonstrações OLT/DNS e compatibilidade](piloto-workflows-executado.md). [Experiência do editor](editor-operacional.md).

> **Migração cadastral posterior:** [resultado da importação dos seis clientes e da equipe, sem novas O.S.](migracao-cadastral.md).

> **Revisão posterior:** este parecer foi superado pela [revisão com conferência completa do contrato 80](revisao-sol.md). A conclusão de três ocorrências e uma O.S. não representava o histórico completo: a API URA retornou **426 ocorrências e 424 O.S.**, todas da Meganet nesse contrato. O texto abaixo foi preservado para comparação com as avaliações anteriores.

**Data:** 20/10/2026
**Escopo:** leitura da documentação local do SGP, comparação com o modelo e fluxo atuais do Ajust ERP e consulta somente leitura das ocorrências e O.S. do cliente SGP ID 60.

## Resumo executivo

O SGP oferece um fluxo maduro de atendimento ligado ao cadastro operacional do provedor: ocorrência, contrato/cliente, POP, tipo, setor, motivo, agendamento e execução de O.S. A documentação também descreve anexos, comentários, anotações, checklist e dados de campo como check-in e assinaturas.

O Ajust ERP já representa melhor a realidade de uma consultoria que precisa coordenar vários provedores e acompanhar analistas, técnicos, prazos e histórico: tem políticas de SLA por prioridade e tipo, calendário útil, exceções, eventos de SLA, transições de status, trilha de auditoria, apontamento de tempo e vínculo de uma ocorrência com várias O.S. Essa vantagem depende de configurar as regras e preencher os cadastros operacionais.

**Recomendação inicial:** usar o Ajust ERP como sistema de gestão da consultoria e migrar do SGP apenas o histórico e os dados necessários para continuidade do atendimento. Preservar os identificadores externos para rastreabilidade. Uma sincronização contínua pode ser avaliada depois, caso a operação precise consultar atualizações do SGP; não é requisito para substituir o fluxo interno da consultoria. Não copiar automaticamente todos os campos: parte deles é específica de atendimento de assinante ou de execução em campo.

## Amostra observada: cliente 60 (Meganet)

A autenticação funcionou com o app `Sistema_de_O.S`. A consulta de chamados retornou três ocorrências para Ariele Kethilin J Silva (Meganet); a listagem de O.S. do cliente retornou uma ordem. Os registros abaixo vieram das rotas `/api/central/chamado/list/`, `/api/os/list/`, `/api/ura/ordemservico/list/` e `/api/os/list/id/11926`.

| Ocorrência | Cadastro e tipo | Estado e conteúdo | O.S. vinculada no retorno |
| --- | --- | --- | --- |
| `260601053900` (ID 10443) | 01/06/2026 05:40 · Problemas com oscilações/quedas · Suporte Online | Encerrada no mesmo horário. Relato de interfaces que ficaram indisponíveis. | Nenhuma indicada; os campos de O.S. vieram vazios. |
| `260930175900` (ID 11817) | 30/09/2026 18:04 · Informações · Telefone | Encerrada em 01/10/2026 12:06. Solicitação administrativa sobre preenchimento e envio de formulário. | Nenhuma indicada; os campos de O.S. vieram vazios. |
| `261019175100` (ID 11990) | 19/10/2026 17:53 · Configuração Zabbix/Grafana · Suporte Online | Aberta. Alerta de lentidão com pedido para verificar a máquina. | O.S. ID 11926, aberta, corretiva, prioridade numérica 2 (normal conforme a documentação), atribuída a Vitor Andrade. |

O detalhe da O.S. 11926 contém cadastro em 19/10 às 17:53:52, agendamento registrado para 17:53:37, sem finalização, setor vazio, sem técnicos auxiliares e sem serviço prestado, observação ou anotação preenchidos nos campos próprios. A confirmação do agendamento está como falsa. Como o horário de agendamento aparece 15 segundos antes do cadastro e não está confirmado, convém preservar ambos os valores e não tratá-lo automaticamente como compromisso efetivo.

O histórico tem dois comentários posteriores ao cadastro. Um deles traz um relatório técnico detalhado sobre ajuste de triggers no Zabbix, incluindo contexto, alterações feitas e o efeito esperado na redução de falsos alarmes e flapping; o outro é uma nota curta sobre a revisão do relatório. Isso mostra que parte importante do trabalho pode estar nos comentários, mesmo quando `serviço prestado` e `observação` continuam vazios.

Nas três ocorrências, o SGP associa cliente, contrato 80 e POP/contrato identificados como Consultoria. Para importar esse tipo de caso, o identificador e protocolo externos são importantes: nome do provedor sozinho não dá vínculo confiável. A resposta também inclui dados de serviço e acesso que não são necessários para a gestão de O.S.; credenciais, endereços e parâmetros de rede devem ficar fora da sincronização proposta.

## O que a API do SGP documenta

Referência: [`API-SGP-completa.txt`](../API-SGP-completa.txt). A documentação descreve mais de uma família de endpoints; o payload varia conforme a API.

| Área | Campos e recursos documentados |
| --- | --- |
| Consulta de ocorrência (`/api/ura/ocorrencia/list/`) | Número, status, POP, tipo, contrato, status do contrato, datas/horas de cadastro, agendamento e finalização; paginação por `offset`/`limit` (máximo documentado de 1.000). |
| Consulta de O.S. (`/api/ura/ordemservico/list/`) | ID, status, ocorrência vinculada, motivo, POP, contrato, status do contrato e datas/horas de cadastro, agendamento e finalização. |
| Central/chamado | Lista O.S. com filtros por cliente, contrato, O.S., status da O.S. e status da ocorrência; criação/atualização documenta contato, conteúdo, setor, tipo, responsável, técnico, serviço prestado, prioridade, agendamento, observação, anotação e notificação. |
| Execução da O.S. (`/api/os/...`) | Status aberto/em execução/pendente/encerrado; serviço prestado, observação, datas, check-in com coordenadas, assinaturas, classificações, imagens, comentários, anotações e checklist. |

Os status numéricos mais recorrentes documentados para O.S. são `0=Aberta`, `1=Encerrada`, `2=Em execução` e `3=Pendente`. O SGP também possui conceitos de POP, contrato de serviço, motivo, método e tipo de ocorrência. Esses códigos e catálogos devem ser obtidos da própria API/painel e mapeados; não convém assumir equivalência direta com os enums internos do Ajust ERP.

## Comparação com o Ajust ERP atual

| Tema | SGP, conforme documentação | Ajust ERP no código atual | Leitura para a consultoria |
| --- | --- | --- | --- |
| Relação ocorrência–O.S. | A O.S. pode ser filtrada pela ocorrência; o fluxo de chamado permite uma ocorrência sem O.S. em certos casos. | A ocorrência criada pelo fluxo principal já nasce com a primeira O.S.; podem ser abertas O.S. adicionais na ocorrência. | O Ajust ERP dá uma visão de incidente como caso de trabalho com várias frentes. Confirmar se a regra de sempre criar uma primeira O.S. representa todos os processos da empresa. |
| Cliente/provedor | Forte vínculo a cliente, contrato, POP e status do serviço. | Ocorrência tem `provider` como texto; não há no modelo analisado um ID externo de cliente/contrato/POP na ocorrência. | O maior ponto de adaptação é identidade: associar a ocorrência ao provedor cadastrado e guardar IDs de cliente/contrato/POP do SGP, em vez de depender somente do nome. |
| Ocorrência sem O.S. | Na amostra, duas de três ocorrências encerradas não retornaram O.S. vinculada. | A criação de ocorrência exige uma primeira O.S. no fluxo principal. | Para importar o histórico fielmente, permitir ocorrência sem O.S. ou criar uma forma de registro histórico sem inventar uma ordem. |
| Atribuição | A API documenta responsável da ocorrência e técnico da O.S. | A ocorrência guarda analista responsável como texto; O.S. tem responsável/analista em texto e relações opcionais a usuários. | O ERP permite consolidar a equipe da consultoria; vale preferir vínculos de usuário e preservar nomes de origem como snapshot quando necessário. |
| Campos de execução | A O.S. observada tem motivo, prioridade, agendamento e confirmação, técnico, setor, técnicos auxiliares, serviço prestado, observação e comentários. | Existem tipo, prioridade, status, responsável/analista, prazo, setor, origem, comentários, anexos e histórico; não aparecem campos próprios para agendamento SGP, técnicos auxiliares ou serviço prestado. | Guardar os campos de origem que a equipe usa, sem sobrecarregar a O.S. interna. Comentários podem ser importados como eventos com origem SGP. |
| Status e fluxo | Quatro estados operacionais básicos documentados para O.S.; a ocorrência tem status próprio. | O.S. diferencia análise, espera de campo, espera de terceiros, resolvida, fechada e cancelada; ocorrência tem aberta, em execução, pendente e encerrada. | O Ajust ERP descreve melhor os gargalos da consultoria. Precisamos definir tradução bidirecional ou somente leitura, sem forçar perda de estados. |
| SLA | A documentação consultada fornece datas e status; não descreve uma política configurável de SLA por prioridade/tipo nem calendário útil nessa família de endpoints. | Políticas por prioridade/tipo, calendário de expediente e exceções, prazos nas O.S., consulta de violações e trilha de auditoria de SLA. | Diferencial claro do Ajust ERP para gestão, desde que o SLA seja calibrado para contratos e compromissos reais da consultoria. |
| Histórico e evidências | Anotações, comentários, checklist, imagens, check-in e assinaturas descritos em endpoints separados. | Eventos de status e auditoria, comentários/anotações, anexos com visibilidade interna, aprovações e apontamento de tempo. | Há sobreposição. Importar eventos relevantes e metadados pode ajudar; copiar anexos, assinaturas ou coordenadas deve depender do uso e da política interna. |
| Relatórios e coordenação | A documentação apresenta endpoints de lista e operação; escopo voltado ao atendimento do provedor. | Painéis de O.S./SLA, agenda, técnico, relatórios, tempo e trilha de fluxo já fazem parte do produto. | O Ajust ERP é mais aderente ao acompanhamento multi-provedor; falta validar na prática a qualidade dos cadastros, filtros e visões gerenciais. |

## Pontos fortes e lacunas do Ajust ERP

**Pontos fortes observados:** separa ocorrência de O.S.; cada ordem tem seu próprio prazo e prioridade; diferencia estados de espera que explicam bloqueios; tem calendário útil, políticas configuráveis e visão de violações; registra transições, anotações e tempo de trabalho; permite restringir conteúdo visível ao cliente.

**Lacunas relevantes para integrar com o SGP:** o modelo de ocorrência guarda o provedor como texto, não tem protocolo externo nem IDs próprios para cliente, contrato ou POP. `ServiceOrder.externalProtocol` existe, mas deve receber uma chave estável e única do SGP; convém guardar separadamente o número de exibição e a ocorrência externa relacionada. O fluxo de criação também exige uma O.S., enquanto a amostra contém ocorrências encerradas sem O.S. Além disso, não há campos dedicados para agendamento externo, confirmação do agendamento, técnicos auxiliares ou serviço executado. É necessário fechar o mapeamento dos estados, tipos, prioridades, técnicos, setores e datas, preservando o status original do SGP separado da etapa interna.

Esta análise compara documentação e código, não demonstra a experiência visual completa nem comprova que todos os módulos estejam configurados ou em uso no ambiente da empresa.

## Modelo de adaptação sugerido

1. **Ajust ERP como registro de gestão:** a consultoria acompanha provedor, responsável interno, analista/técnico, prioridade, prazo/SLA, motivo de espera, histórico e resultado.
2. **Migração com origem rastreável:** guardar sistema de origem e IDs do cliente, contrato, POP, ocorrência e O.S.; manter protocolo do Ajust ERP separado do identificador SGP. Depois da migração, a consultoria passa a registrar os novos atendimentos no Ajust ERP.
3. **Sincronização seletiva:** trazer identificação externa, conteúdo/resumo, tipo/motivo, prioridade, status original, datas relevantes, técnico e link/protocolo externo. Trazer comentários como histórico atribuído à origem SGP. Excluir credenciais de acesso, parâmetros de rede e dados pessoais sem uso no atendimento da consultoria.
4. **Histórico rastreável:** registrar horário de sincronização, origem, resultado, alterações e conflitos. Não sobrescrever campos internos de gestão com atualizações do SGP sem regra explícita.
5. **SLA próprio da consultoria:** calcular o prazo conforme política interna e calendário acordado. Datas do SGP servem de contexto; não devem virar automaticamente o SLA da consultoria.
6. **Dados de campo opcionais:** check-in, assinatura, imagem e checklist só devem ser incorporados se a consultoria realmente acompanha a execução técnica em campo.

## Feedback inicial: qual é melhor?

Para administrar atendimento de assinantes, contratos, POPs e execução de O.S. de um provedor, o SGP é mais completo e tem contexto operacional nativo. Para uma consultoria que presta suporte a diversos provedores e precisa enxergar responsáveis, gargalos, prazos e desempenho entre eles, o Ajust ERP tem um desenho mais aderente e um controle de SLA mais explícito.

Assim, para substituir o fluxo interno da consultoria, o Ajust ERP é o mais aderente à gestão e ao acompanhamento. O SGP fornece o histórico que deve ser migrado e contexto do cliente/provedor. A amostra confirma que uma ocorrência pode ser apenas informativa e encerrada sem O.S., enquanto uma ocorrência técnica aberta pode ter uma O.S. atribuída e comentários ricos em detalhes. O Ajust ERP tem SLA e acompanhamento interno mais explícitos; antes da migração, precisa representar ocorrências sem O.S. e conservar os identificadores e comentários do SGP.

## Próxima etapa da análise

O levantamento do cliente 60 está concluído para as três ocorrências retornadas e a única O.S. associada. Como próxima etapa do projeto, validar com os gestores quais campos de origem entram na apresentação e definir o mapeamento de IDs, status e comentários antes de implementar a migração seletiva do histórico.
