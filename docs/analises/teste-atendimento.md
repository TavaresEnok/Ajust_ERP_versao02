

# Teste de ciclo de atendimento - Ajust ERP

Ambiente: https://erp.ajustconsulting.com.br
Data: 2026-11-09
Regras: nenhum codigo ou configuracao alterado; dados de teste com TESTE IA no título; nenhum commit aplicado.

Credenciais (tela de login):
- Gerente: gestores.admin@ajust.invalid
- Analista: anderson.alves@ajust.invalid

Caso 1 - Configuracao e ativacao de equipamento (fluxo de 4 etapas)
- Servico selecionado no catalogo: Configuracao e ativacao de equipamento
- Titulo: TESTE IA - Configuracao e ativacao de equipamento
- Tipo: INFRAESTRUTURA | Provedor: AJUST CONSULTING | Setor: Atendimento
- Prioridade: NORMAL | Responsavel: Ajust Analista
- Resultado: Ocorrencia 2026260001 aberta; O.S. #2026100001 aberta (09/11/2026, 15:32:55)
- Notificacao: Ocorrencia e primeira O.S. criadas
- Painel da gerencia: Pendentes agora passou de 0 para 1 (acompanhou a criacao)
- Fluxo de etapas: etapa 1 Configurar, ativar e validar equipamento exibida
  - Nao foi possivel avancar as 4 etapas (sem acao Avancar etapa; Registrar e avancar falhou com Selecione um item da lista)
  - Aplicar acao (resultado Concluido) PAUSOU o processo: Aguardando: Configurar, ativar e validar equipamento
  - Botoes de avancar ficaram disabled apos a pausa; nao ha acao de Retomar
  - Pausa: nao houve campo de prazo visivel para conferir se parou; painel mostrou Pausadas 0
  - Conclusao/aprovacao pelo gerente: nao executada (etapa nao alcançada)

Caso 2 - Criacao de DNS e Caso 3 - trabalho ja realizado
- NAO CRIADOS. O formulario exige 4 campos obrigatorios (*) via seletores customizados Selecione um registro que nao preencheram de forma confiavel (opcoes misturadas). O modal nao fechou e a O.S. nao foi criada.

Erros observados:
- Selecione um item da lista. (avancar etapa sem campo obrigatorio)
- Preencha este campo. (validacao HTML5 justificativa/motivo)
- Sem erros de rede no console.

Tempos de resposta observados:
- Login gerente: ~471 ms
- Carregar painel da gerencia: ~35 ms
- Abrir modal Abrir atendimento: ~141 ms
- Carregar catalogo de servicos: ~25 ms
- Criar O.S. (clique em Abrir atendimento): ~88 ms
- Navegar para tela do processo: ~80 ms

Registro criado para apagar:
- O.S. #2026100001 + Ocorrencia 2026260001 (titulos com TESTE IA)
Nenhum outro registro, usuario, cliente ou provedor criado. Sem commit, sem alteracao de codigo ou configuracao.
