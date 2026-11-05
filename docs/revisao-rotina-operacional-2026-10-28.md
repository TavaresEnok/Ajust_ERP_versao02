# Rotina operacional — ordens, provedores e agenda

Revisão de 28/10/2026. Objetivo: reduzir a navegação e o preenchimento repetido na rotina do analista, mantendo o fluxo publicado pela gestão e o acompanhamento dos gerentes.

## Ordens de serviço

- Separação entre pendentes, concluídas e todas as ordens, aplicada no banco antes da paginação e compartilhada com os indicadores. Resolvidas e fechadas são concluídas; canceladas ficam em todas, sem simular entrega.
- Ordenação por data, prazo e prioridade com desempate por ID, evitando resultados instáveis entre páginas com valores iguais.
- Busca com pequeno intervalo antes da consulta. Escopo, busca, filtros, ordenação e página ficam na URL. Abrir uma ordem pela lista e voltar preserva esse contexto.
- Datas dos filtros são interpretadas em Fortaleza, independentemente do fuso do navegador.
- A aba Atendimento apresenta a versão em execução, a etapa, as evidências exigidas e o destino de cada resultado. O botão distingue conclusão de etapa e encerramento da ordem.
- Cada evidência possui seu próprio campo. Não é necessário repetir as evidências no campo de observações. O motor recebe os campos separados e continua validando requisitos, permissões, dependências e versão. Integrações antigas que enviam um registro combinado continuam compatíveis.
- Rascunhos ficam na mesma aba, separados por sessão autenticada e ordem, com validade de até 24 horas. Navegação e recarga recuperam os campos; confirmar a etapa ou descartar limpa o preenchimento. Se o armazenamento do navegador estiver indisponível, existe uma cópia em memória para a navegação na aba. Rascunho não envia uma operação ao ERP.
- Atalhos do detalhe levam ao provedor, ao cofre já selecionado e à data do agendamento. Esses atalhos internos não são apresentados ao cliente.

## Provedores

- A busca inclui razão social, documento, localização e contatos, desconsiderando acentos.
- A lista informa as ocorrências em aberto; o detalhe reúne ocorrências abertas, ordens pendentes e atrasadas das ocorrências vinculadas ao cadastro.
- E-mail e telefone ficam disponíveis como contatos rápidos, com links para o aplicativo correspondente quando o valor é válido.
- Ordens pendentes podem ser abertas diretamente na ocorrência do provedor, com indicação da situação do prazo.
- Cofre e orientações técnicas abrem com o provedor selecionado. A seleção permanece após recarregar e não revela senhas automaticamente.
- Cadastro completo e contatos permanecem acessíveis separadamente dos atendimentos.

## Agenda

- Busca por título, descrição, local e responsável; filtros de compromissos pessoais, equipe e O.S. vinculadas.
- Visualizações por mês, lista e dia, navegação direta por data e criação no dia selecionado. Dias com muitos eventos oferecem acesso à lista completa do dia.
- A gestão possui escopo explícito de agenda pessoal/equipe e filtro de responsável. Trocar a visualização não muda silenciosamente o escopo.
- Mesmo formulário de horários de Fortaleza para analistas e gerentes, incluindo eventos globais da gestão. Alternar dia inteiro preserva os horários digitados.
- Consulta de conflitos antes de gravar, apresentando os compromissos coincidentes. O servidor continua realizando a validação final; a interface não contorna conflitos.
- Agendamentos gerados por O.S. permanecem para consulta na agenda, com acesso à ordem para execução e reagendamento.
- O bloqueio de envio cobre a gravação e a atualização da tela. Falha ao atualizar depois de salvar não deixa o formulário disponível para repetir a criação inadvertidamente.
- Atualização periódica, estados de erro com nova tentativa, eventos com intervalo completo e acesso à cobertura de plantão do dia.

## Verificação executada

- Typecheck de web e API; lint dos arquivos alterados; formatação e integridade do diff.
- 50 testes aprovados em três suítes: operações, listagem/filtros e agenda.
- Integração com banco real e rollback: evidência ausente rejeitada, campos separados preservados, agendamento, pausa, encaminhamento, conclusão, geração de três entregas e reabertura sem duplicação.
- `scripts/check-analyst-flow-guidance.cjs`: ordenação/paginação reais e cenários de interface com operações simuladas para evidências, rascunhos, resultados, permissões, dependências e falhas de consulta.
- `scripts/check-operational-usability.cjs`: navegação real entre ordens/provedor/cofre; agenda simulada para conflitos, horários, escopo gerencial, proteção de agendamentos de O.S. e gravação seguida de falha na atualização.
- `scripts/check-analyst-daily-journey.cjs`: criação, edição e exclusão reais de compromisso temporário, com limpeza; navegador em outro fuso e layout móvel.
- `scripts/check-sla-simplification.cjs`: filtros de prazo e acompanhamento gerencial com dados reais, sem modificar ordens.
- `scripts/check-analyst-pages.cjs`: 12 páginas do menu carregadas sem exceções de JavaScript ou respostas de API 4xx/5xx, incluindo verificação de largura móvel.

Não foram modificadas definições publicadas de fluxos, escalas ou ordens operacionais reais para executar esses testes. A revisão cobre as jornadas descritas; não substitui homologação dos fluxos de negócio específicos de cada serviço.
