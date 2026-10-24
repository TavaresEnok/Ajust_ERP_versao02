# Atendimento: provedor → ocorrência → O.S.

## Entrega

- Provedor lista ocorrências, total de O.S. e O.S. ainda em atendimento.
- A ocorrência abre diretamente com descrição da demanda e tabela de todas as O.S. vinculadas; não depende de encontrar uma aba.
- Breadcrumb do provedor e link de retorno da O.S. para sua ocorrência preservam o contexto.
- Nova ocorrência, no provedor, herda seu cadastro. A abertura registra a ocorrência e a primeira O.S. numa transação existente, agora com customerId e identificadores reais dos responsáveis.
- O botão de abertura na lista de O.S. permite nova ocorrência ou adicionar O.S. a uma existente. Dentro da ocorrência, Adicionar O.S. fixa o vínculo e preenche provedor, origem, setor e usuário de abertura conhecidos.
- Formulário da O.S. mantém Encerramento, Anotações, Editar, Anexos e Histórico. A ocorrência oferece anotações, edição e histórico próprios abaixo da lista de ordens.
- O.S. avulsas antigas permanecem intactas e são identificadas como sem ocorrência. Não houve agrupamento automático de dados antigos.

## Segurança e compatibilidade

O cadastro de cliente é validado no ambiente autenticado, sem aceitar customerId de outra empresa. Os responsáveis da abertura conjunta devem ter vínculo operacional na Ajust; nomes são resolvidos do cadastro. A operação conjunta usa a transação existente, evitando uma ocorrência sem a primeira O.S. por falha intermediária. APIs legadas continuam compatíveis. Não foram alterados os motores de workflow, as regras de encerramento da ocorrência ou os dados de produção para demonstrar a interface.

Origem e Setor continuam vindo dos cadastros da gestão. Não foram inventadas opções para suprir cadastros vazios. Quando a origem herdada de um registro antigo não pertence à lista atual, o vínculo histórico permanece visível.

## Verificação

- Typecheck web e API.
- Suite API: 471 aprovados, 11 ignorados; novos testes de abertura transacional, escopo do cliente e responsáveis.
- Playwright com conta de analista: provedor → ocorrência → O.S. → retorno; abertura conjunta com provedor herdado e autor preenchido; adicionar O.S. na ocorrência; modos novo/existente na abertura global.
- Envios de criação no navegador interceptados com respostas de teste, sem inserir O.S. ou ocorrências fictícias.
- Nenhum fechamento, reabertura ou reagrupamento de registros reais realizado.

## Regra de encerramento adicionada

A atualização manual para ENCERRADA verifica, numa transação serializável, as O.S. não excluídas da ocorrência na empresa autenticada. Somente FECHADA e CANCELADA são terminais para essa validação; RESOLVIDA ainda bloqueia. Quando há pendências, a API retorna conflito com quantidade e até 20 protocolos, sem atualizar a ocorrência nem as ordens. A tela mostra aviso e links para as ordens pendentes. A data de encerramento é preenchida no fechamento e limpa no retorno a outro estado. Ocorrências controladas por processos continuam sujeitas à autoridade do processo; seu reconciliador já verifica O.S. e processos pendentes.

Verificação após essa regra: 481 testes aprovados e 11 ignorados, typecheck web/API e conferência somente de leitura do aviso no navegador. Não houve encerramento de ocorrências reais para testar. A regra não reorganiza ou corrige automaticamente estados históricos anteriores, nem modifica o comportamento de criação/reabertura de O.S.
