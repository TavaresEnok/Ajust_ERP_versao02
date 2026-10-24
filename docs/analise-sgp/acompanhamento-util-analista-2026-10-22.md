# Acompanhamento do analista

O menu do analista passou a se chamar Acompanhar atendimentos. A lista inicia nos fluxos ativos atribuídos ao usuário por identificador de responsável de uma O.S. não fechada/cancelada. Ativos da equipe e histórico permanecem consultas explícitas. Configuração de modelos, demonstrações e templates legados ficam na gerência.

A página de acompanhamento do analista apresenta as etapas atuais com responsável, O.S., setor, meta proposta e próxima ação. Uma tabela reúne a situação real de todas as ordens vinculadas. Abrir O.S. leva ao atendimento normal do analista; esta página não altera etapas por conta própria.

O diagrama usa azul para execução, verde para conclusão, laranja para espera e pausa, vermelho para falha e cinza para ausência de execução registrada ou cancelamento. Os blocos têm rótulos textuais e permitem consultar sua O.S. Paralelismo permite vários blocos ativos. O estado de cada bloco considera a tentativa mais recente, evitando pintar de verde uma tarefa que retornou à execução.

Históricos importados deixam explícito no topo que não há execução de fluxo registrada no Ajust. A tela separa a situação real da O.S., o tipo recebido do SGP e a classificação do fluxo no Ajust; quando a classificação não foi revisada, aparece como pendente. O desenho fica recolhido e identificado como referência não executada. Não se atribui uma posição atual a partir do status final do SGP. Versões substituídas apontam para a revisão atual quando existe. Em execuções ativas, a tela nomeia a etapa em andamento antes dos cartões e do diagrama.

Verificação: typecheck web/API, lint dos componentes, oito verificações de estados (paralelismo, espera, falha, pausa, cancelamento, retomada e histórico); quatro testes de compatibilidade de perfis aprovados e quatro testes de integração de banco ignorados pela configuração existente. Playwright com a conta de analista conferiu um histórico real, ausência de controles administrativos, referência inicialmente recolhida, seleção de bloco e rótulos dos ramos paralelos, espera e conclusão em resposta de navegador interceptada. Nenhuma O.S., ocorrência ou execução real foi alterada.
