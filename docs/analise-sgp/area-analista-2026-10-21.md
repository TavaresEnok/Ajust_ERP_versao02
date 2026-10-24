# Área do analista — entrega de 21/10/2026

## Objetivo e escopo

Recuperar o foco operacional da área antiga da porta 8071, preservando o design e as ferramentas da porta 8070. A Ajust continua sendo a única empresa operadora; os provedores são seus clientes.

Não houve nova importação, criação de O.S., alteração de atribuições, redefinição de senhas ou mudança de perfis. As verificações de interface usam os registros existentes e sessões normais de autenticação. A aplicação histórica não foi modificada.

## Implementado

- Painel próprio para analistas, sem depender de indicadores exclusivos da gerência.
- Entrada em **Meu trabalho**, com alternância explícita para **Visão geral da Ajust**.
- O.S. pessoais identificadas por `ownerUserId` ou `assigneeUserId`, não por comparação de nomes. O backend aplica o filtro antes da paginação.
- Quatro indicadores: ativas, atrasadas, vencendo hoje e concluídas no período. Clicar em um indicador filtra a lista do painel.
- Ativas e alertas incluem pendências de todo o histórico. O período de 7, 30 ou 90 dias, ou todo o histórico, controla as aberturas e conclusões.
- Alerta de vencimento nas próximas duas horas. O.S. sem prazo válido ou com `slaEligible=false` não entram nos indicadores de atraso.
- Evolução calculada pelas datas de abertura e de resolução/encerramento. Cancelamentos não são entregas; datas ausentes não são inventadas a partir de `updatedAt`. Dias sem eventos permanecem zerados no gráfico.
- Horário de Fortaleza para o recorte diário e os compromissos exibidos.
- Agenda inicial mostra somente eventos em andamento ou nos próximos sete dias, respeitando a consulta pessoal existente e identificando os eventos compartilhados.
- Página de O.S. inicia em **Minhas ordens**, com opção explícita **Todas da Ajust**.
- **Provedores** e **Processos de atendimento** retornam ao menu do analista.
- Menu organizado em Meu trabalho, Conhecimento, Ferramentas técnicas e Minha conta. Os dois últimos grupos são recolhíveis e abrem ao acessar uma de suas páginas.
- Links de configuração de workflows não são oferecidos ao analista nos processos. A autorização administrativa da API não foi ampliada.
- Identificação da página ativa no menu corrigida para os diferentes portais. Contenção da tabela corrigida para evitar transbordamento horizontal da página no celular.

## Contrato de consulta

`GET /service-orders?scope=mine` resolve o usuário a partir da sessão autenticada. Parâmetros externos de identificação de usuário não substituem esse vínculo.

`GET /service-orders?scope=operation`, ou a consulta sem `scope`, mantém o comportamento operacional existente. Essa visão não representa o desempenho individual do analista. As restrições de cliente e o isolamento da empresa permanecem aplicados.

Os indicadores usam o estado atual das ordens: uma O.S. reaberta não é contada como uma entrega atualmente concluída. O gráfico não substitui uma análise de todos os ciclos históricos de reabertura. Para volumes muito maiores, recomenda-se uma consulta agregada no servidor; nesta entrega o painel utiliza a listagem completa do escopo, sem truncar os indicadores em uma página de resultados.

## Validação

- API: **449 testes aprovados**; 11 testes já ignorados em 3 suítes.
- Worker: **31 testes aprovados**.
- Verificação pura do painel: **28 assertivas**, incluindo datas, virada de dia, elegibilidade SLA, vínculos e navegação.
- Typecheck de API e web aprovado.
- Lint dos arquivos alterados sem erros; permanecem avisos anteriores de navegação com `window.location.assign` e argumento não utilizado no controller.
- Teste de navegador com Anderson, gestor e cliente: aprovado; nenhum erro de execução ou resposta de erro inesperada da API na navegação do analista.
- Layout móvel verificado em 390 × 844, sem transbordamento da página.
- Bloqueios administrativos do analista confirmados com HTTP 403: usuários, empresas, auditoria, indicadores gerenciais e workflows.

Na consulta de validação, Anderson tinha **6 O.S.: 1 ativa e 5 concluídas com data conhecida**. A ativa não era elegível para SLA. O conjunto operacional continha 168 O.S., 6 clientes cadastrados e 122 execuções retornadas pelo endpoint operacional. Esses totais são registros existentes, não significam que toda a base do SGP foi migrada nem que todas as ordens do ERP vieram do SGP.

## Reprodução

```bash
node apps/api/node_modules/tsx/dist/cli.mjs scripts/check-analyst-workspace.ts
corepack pnpm --filter @ajust/api test -- --runInBand
corepack pnpm --filter @ajust/worker test -- --runInBand
corepack pnpm --filter @ajust/web typecheck
corepack pnpm --filter @ajust/api typecheck
```

O teste `scripts/check-analyst-workspace-ui.cjs` recebe um arquivo privado de contas por `ERP_REVIEW_ACCESS_FILE`. `ERP_REVIEW_ARTIFACTS` pode apontar para uma pasta privada de evidências e sessões de teste, fora do repositório. Não registrar senhas ou sessões neste documento.

## Acesso

Área atual: `http://168.194.13.18:8070/analista`. As credenciais existentes foram preservadas.
