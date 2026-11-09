# Jornada da gerência: fluxos, automações e acompanhamento

Verificação em 06/11/2026. **Resultado final: 16 cenários aprovados no Chromium**, com oito cenários novos da gerência e oito da jornada do analista como regressão. A execução conjunta terminou em aproximadamente 1,3 minuto, após compilar API e frontend.

## Avaliação de uso

O acompanhamento de O.S., responsáveis, provedores e atrasos funcionou na verificação inicial. A configuração exigia mais conhecimento técnico: o gerente precisava lidar com chaves de O.S., IDs de etapas, conexões e parâmetros de desenho. Havia também falhas que impediam usar um fluxo novo pelo catálogo e distorciam os números da equipe.

O percurso comum agora é: **criar fluxo → acrescentar etapas ou entregas paralelas → simular → salvar/publicar → vincular ao serviço do catálogo → abrir e acompanhar as O.S.** As automações por evento têm uma explicação própria, exemplo pronto e registros de execução vinculados às O.S.

Essa é uma avaliação técnica com execução real pelo navegador e inspeção de capturas. A facilidade de aprendizado ainda deve ser homologada com gerentes reais e os serviços habituais da operação. Condições e integrações personalizadas continuam exigindo conhecimento das regras da empresa e de seus destinos externos.

## Problemas encontrados e correções

| Problema                                                                                                            | Correção                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O catálogo oferecia apenas quatro fluxos fixos. Um novo fluxo publicado não podia ser escolhido pelo formulário.    | Consulta os fluxos publicados da empresa e permite vinculá-los pelo nome. O teste publicou um fluxo novo, criou seu serviço e executou uma O.S. seguindo suas etapas.                                                    |
| Uma sequência simples exigia configurar manualmente a próxima conexão e transferir o fechamento para a etapa final. | **Adicionar próxima etapa** monta a conexão na mesma O.S. e transfere o resultado de encerramento para a nova etapa.                                                                                                     |
| Entregas paralelas exigiam montar divisão, duas O.S., junção e suas referências internas.                           | **Adicionar duas entregas paralelas** prepara os blocos, as O.S. complementares e a espera pelas duas conclusões. O gerente ajusta os nomes e requisitos.                                                                |
| A edição de evidências removia a quebra de linha durante a digitação.                                               | Preserva a digitação, inclusive Enter, e mantém os requisitos sem linhas vazias ou duplicadas na definição enviada.                                                                                                      |
| Chaves como `root`, IDs, limites de repetição e posições do desenho apareciam no percurso comum.                    | Escolhas por nomes, seleção de entregas por checkbox, configurações avançadas recolhidas e formulário de automação sem exigir coordenadas. Campos de execução aparecem nas etapas humanas.                               |
| O novo cadastro de automação permanecia na tela de criação; salvar outra vez podia criar outra regra.               | Após criar, abre a automação salva. As alterações seguintes atualizam o mesmo registro.                                                                                                                                  |
| A tela de logs explicava contratos internos e não permitia consultar execuções.                                     | Consulta os últimos 50 registros, com data, etapa, resultado e link para a O.S. A auditoria de configuração permanece separada das execuções.                                                                            |
| O contador da equipe considerava apenas O.S. importadas do SGP.                                                     | Considera as O.S. atribuídas de todas as origens e desconta demonstrações. Os testes unitários cobrem estados ativos, concluídos, cancelados e demonstrações.                                                            |
| O detalhe do técnico misturava O.S. atribuídas com ordens apenas abertas por ele.                                   | Mostra as ordens atribuídas ao integrante. Rótulos deixam claro que os totais não estão restritos a “hoje”.                                                                                                              |
| Havia formulários diferentes para políticas de SLA, com explicações divergentes sobre prioridade.                   | O menu de políticas abre o mesmo workspace de calendário e simulação, diretamente na aba Políticas. O formulário indica que o prazo por tipo vale para as prioridades e não reescreve automaticamente prazos existentes. |
| Alertas genéricos sobre contas bloqueadas apareciam mesmo sem bloqueios.                                            | O aviso aparece quando há analista bloqueado; a equipe também ganhou atualização e estados de carregamento/erro.                                                                                                         |

O editor visual, a validação, as permissões, a simulação e os controles de publicação foram preservados. O diagrama de atendimento foi reduzido de 540 para 360 pixels de altura, aproximando as ações e os campos de configuração.

## Cenários da gerência executados

| Cenário                   | Evidência verificada                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navegação principal       | Painel, fluxos, automações, SLA, técnicos, provedores, processos, serviços e políticas carregam sem exceções do navegador ou respostas de erro do BFF.                                                                     |
| Fluxo sequencial          | Digitação de evidências com Enter; inclusão de etapa; simulação sem criar O.S.; rascunho; publicação; vínculo ao catálogo; execução até o encerramento. Uma publicação posterior mantém a versão do atendimento já aberto. |
| Fluxo paralelo            | Construção pelos atalhos; seleção das entregas da junção por nome; simulação; publicação; serviço do catálogo; geração e execução de duas O.S. A ocorrência só encerra depois das duas entregas.                           |
| Automação real            | Exemplo de pesquisa de satisfação; cadastro inicialmente inativo; edição/ativação sem duplicar; fechamento de O.S.; registro de execução concluída e pesquisa sem duplicação.                                              |
| Acesso aos registros      | Gerente consulta os registros; analista recebe 403; regra de outra empresa recebe 404. A resposta não inclui o contexto completo nem o resultado interno dos nós.                                                          |
| Política e cálculo de SLA | Cadastro de prazo DNS de quatro horas, simulação e alteração para seis horas pelo mesmo formulário.                                                                                                                        |
| O.S., equipe e provedor   | Criação pela gerência com atribuição ao analista; conferência do contador com o banco; simulação de prazo já ultrapassado; filtro de atrasadas; abertura da O.S., detalhe do analista e resumo do provedor.                |
| Celular                   | Fluxos, SLA, técnicos e provedores em 390 × 844, sem transbordamento horizontal da página. Tabelas e diagrama mantêm seus próprios controles.                                                                              |

Os oito cenários anteriores do analista também passaram, incluindo reabertura, troca de responsável, concorrência com preservação do rascunho, agendamento e aprovação pendente.

## Reprodução e evidências

```bash
# Apenas a jornada da gerência
pnpm test:manager:journey

# Gerência e regressão do analista no mesmo ambiente descartável
pnpm test:manager:journey --project=analista
```

Requer dependências instaladas, Prisma Client gerado, Docker e Chromium do Playwright. O runner compartilha a preparação isolada da jornada do analista: banco PostgreSQL local `ajust_ci`, Redis e servidores em portas aleatórias, com usuários fictícios. Remove os contêineres e encerra os servidores de teste ao terminar. A execução também foi incluída no CI, mediante `E2E_MANAGER_JOURNEY=1` e proteção do banco/tenant de teste.

Execução final preservada em `/tmp/ajust-manager-journey.P3E3c7/`:

- `journey.log`: resultado dos 16 cenários.
- `browser/`: capturas das telas principais, fluxo paralelo, automação executada, provedor e versões em celular.
- `api.log`, `web.log`, `api-build.log` e `web-build.log`: serviços e compilações da execução.

Validações complementares:

- API: **687 testes aprovados**, 22 condicionados a banco não executados pela suíte unitária. A jornada do navegador usou PostgreSQL real e conferiu as gravações.
- Lint de todos os pacotes e revisão dos arquivos finais: aprovados.
- Formatação e verificação TypeScript dos pacotes: aprovadas.
- Compilação da API e frontend: aprovada.
- Sintaxe dos scripts Bash, organização da raiz e `git diff --check`: aprovados.

## Limites da verificação

Não houve deploy, alteração dos registros em uso ou mudança das senhas demonstrativas. E-mails, Slack e webhooks externos não foram enviados nesta verificação. Foram exercitados fluxos novos criados pela interface; isso não certifica individualmente todos os fluxos já cadastrados no ambiente atual, grandes volumes ou todos os caminhos de condições personalizadas. Nesta primeira execução, o percentual individual de cumprimento de SLA não foi certificado. Essa pendência foi corrigida e validada posteriormente; veja [Correção do SLA individual](sla-individual-2026-11-06.md).
