# Editor de workflows: experiência entregue e limites

21/10/2026. Acesso: Gestão → Workflows → Fluxos de atendimento. A aba Automações por evento mantém regras pontuais separadas.

## Criar e editar

- Selecionar um dos modelos propostos ou criar novo fluxo.
- Arrastar blocos no diagrama; clicar para editar propriedades no painel abaixo.
- Conectar pontos para criar uma saída e reconectar uma ligação existente. Cada saída tem um resultado nomeado; texto e destino também podem ser alterados no painel.
- Adicionar/excluir blocos e saídas. Usar tipo tarefa, paralelismo, junção ou fim.
- Definir setor, perfis autorizados, responsável opcional, categoria técnica, evidências, prazo e resultados que fecham a ordem.
- A chave de trabalho `root` mantém as etapas na principal. Outra chave representa uma O.S. derivada, criada uma vez e reutilizada pelas etapas dessa chave.
- A junção lista predecessores obrigatórios, todos diretamente gerados pelo mesmo paralelo. Ela não deve esperar uma decisão exclusiva que pode não ocorrer.

## Revisar antes de publicar

**Validar configuração** verifica IDs, destinos, conectividade, caminhos até o fim, saídas, resultados de fechamento e junções suportadas. A mensagem aparece no editor. **Salvar rascunho** preserva a versão publicada; rascunhos podem conter ligações pendentes, mas precisam respeitar o formato dos campos. **Publicar nova versão** exige validação e checa revisão concorrente.

**Simular sem criar O.S.** permite escolher resultados de tarefas e visualizar caminhos e ramos ativos. A simulação não grava ordens, não modifica histórico nem envia avisos. Não é uma execução de integrações nem previsão garantida de tempo/carga da equipe.

## Executar e acompanhar

A tela Processos mostra o mesmo grafo, com etapas concluídas e ativas. Exibe separadamente estado da principal, estado do processo e progresso das derivadas. Cada etapa exige evidências e resultado; o formulário permite encaminhar a mesma ordem. Histórico, tentativas, falhas e eventos ficam disponíveis na execução. Pausa, cancelamento, retomada e reabertura exigem justificativa; ações críticas exigem gestor.

Publicar outra versão não altera execuções em andamento. A execução sempre usa o snapshot publicado no seu início. Modelos antigos arquivados continuam legíveis nas execuções que os utilizaram.

## Fora deste piloto

Não há lanes por setor, colaboração simultânea com cursores, biblioteca de símbolos Lucidchart, importar/exportar diagramas Lucid, subfluxos aninhados, junções dinâmicas, depurador passo a passo do backend, minimapa de auditoria temporal nem simulação estatística. A API valida o grafo, mas não substitui homologação das regras do negócio. O objetivo entregue é experimentar o processo operacional real com editor nativo, não declarar equivalência completa ao Lucidchart.
