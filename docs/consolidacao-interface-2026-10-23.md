# Consolidação da interface — 23/10/2026

## Entregue na porta 8070

- Painéis de gerência e analista com gráficos visíveis, indicadores e acesso à fila operacional. A consulta compartilhada percorre as páginas da API; não calcula o painel apenas com a primeira página de O.S. Há limite explícito de 10 mil registros, com erro em vez de total parcial silencioso.
- Abertura de demanda identificada como **Novo atendimento**; uma entrega dentro de uma ocorrência existente continua **Adicionar O.S.** Não foi criado um passo operacional adicional.
- Cofre com edição de múltiplos acessos por equipamento: método, endereço, porta, usuário, senha, contexto de rede e instruções. Os dados estruturados ficam criptografados no campo protegido existente, com leitura compatível com os cadastros antigos.
- Edição protegida por versão: se outra pessoa alterar o cadastro durante a edição, o salvamento é recusado para evitar perda silenciosa da alteração anterior. O formulário conserva o texto digitado quando o servidor recusa o salvamento.
- Consulta de acessos auditada; listagens não retornam os acessos protegidos. O corpo `accessEntries` é removido dos dados registrados pelo interceptor de auditoria.
- Portal do cliente com datas e início do mês em Fortaleza, cópia de protocolo compatível com o acesso HTTP atual e mensagens distintas para lista vazia e busca sem resultados. A resolução é a referência da conclusão mensal; o fechamento administrativo posterior não conta novamente.

## Organização dos dados reais

25 cadastros da Meganet receberam um acesso estruturado a partir de dados já existentes e inequívocos. O texto de referência e a fonte criptografada foram preservados. Nenhum equipamento foi excluído nesta conversão.

Uma nova prévia do script retornou `organized: 0`, `already: 25`, `pendingReview: 29`: a repetição não propõe recriar os 25 acessos. Os 29 casos restantes do recorte técnico precisam de conferência, por conterem contas, endereços ou instruções que não permitem associação segura automática. Isso não significa que toda a informação do cofre esteja normalizada.

Backup anterior à conversão: `/tmp/ajust-vault-structure.zYCKWn/database.dump`, com acesso restrito. É uma cópia temporária, não uma política de retenção de produção.

## Verificação executada

- Typecheck de web e API aprovado; ESLint dos componentes alterados aprovado.
- 59 testes aprovados em seis suítes. Cinco testes em duas suítes de integração não foram executados por dependerem de ambiente específico; não são evidência de validação integral da execução operacional.
- Navegador: três perfis, gráficos, abertura e cancelamento do formulário de atendimento, abertura e cancelamento da edição do cofre, e layout de 390 px sem transbordamento horizontal no painel.
- Regressões adicionais: seleção de provedor, modos de visualização do cofre, orientações, exclusão com confirmação cancelada, gerador de senhas, Ajustpedia e gráficos/filtros do analista.
- Cliente bloqueado nos endpoints de credenciais e processos operacionais. Meganet tem uma O.S. vinculada, mas nenhuma compartilhada com o cliente: o portal retorna zero corretamente. A visibilidade não foi alterada para preencher artificialmente essa tela; o detalhe de uma O.S. pública não foi validado nessa jornada.

## Limites da entrega

A versão 8071 não foi alterada. Esta entrega consolida as jornadas citadas, não certifica todas as páginas do ERP nem a prontidão para produção. Permanecem necessárias a conferência dos acessos ambíguos, políticas definitivas de SLA e distribuição, retirada dos acessos rápidos de demonstração, HTTPS e retenção/restauração de backups.

## Correção posterior — origens de atendimento

O cadastro `Tenant.orderOrigins` da Ajust estava vazio (`[]`), deixando o campo obrigatório Origem sem opções. Foram cadastradas **WhatsApp, Ligação, Chat e Gestor** pela API de configuração, com autenticação de gerente e auditoria normal. Não foram adicionadas opções fictícias apenas no frontend nem alteradas as origens das O.S. existentes. O script `scripts/check-attendance-origins.cjs` verifica a consulta e a seleção no formulário para gerente e analista; `--configure` adiciona somente os nomes ausentes, preservando os já cadastrados.

## Correção posterior — iniciar execução

O botão principal **Iniciar execução** envia diretamente a operação, sem abrir outro formulário nem exigir justificativa. O segundo botão de início e o campo de texto para essa ação foram removidos. Há bloqueio durante o envio, confirmação visível e atualização da situação atual. Justificativas e resultados continuam obrigatórios nas demais operações.

A API aceita `start` sem `reason`, mantendo versão obrigatória e restrição aos perfis internos. O histórico registra **Execução iniciada.**, com o usuário e o horário do evento. O status persistido continua `EM_ANALISE`, conforme o contrato existente; o painel de trabalho identifica **Em andamento**. Isso não adiciona um cronômetro de horas trabalhadas.

Verificação: 13 testes aprovados em duas suítes, incluindo integração real com rollback (`PROCESS_DB_TESTS=1`); typecheck de API/web e ESLint do componente aprovados. O script `scripts/check-start-execution.cjs` confirmou no navegador o POST sem justificativa, resposta 201, status `EM_ANALISE`, versão 2, um registro de início e um evento de status, e manutenção da situação após recarregar. A O.S. e a ocorrência temporárias, identificadas exclusivamente pelo teste, foram removidas; auditoria preservada. Nenhuma O.S. preexistente foi iniciada pelo teste.
