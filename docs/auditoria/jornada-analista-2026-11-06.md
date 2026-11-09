# Jornada do analista: ordens de serviço

Verificação em 06/11/2026. **Resultado: 8 cenários passaram no Chromium, em 46,2 segundos**, após compilar API e frontend. O percurso usou login de analista, telas reais, BFF, API NestJS, PostgreSQL e Redis. As gravações e os estados do workflow foram conferidos diretamente no banco de teste.

## Cenários executados

| Cenário                                                           | Resultado conferido                                                                                                                                                                           |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir, editar, anotar, iniciar, pausar, retomar, fechar e reabrir | Título e descrição persistem; anotações e dois fechamentos permanecem no histórico; reabertura limpa as evidências da nova tentativa; rascunho sobrevive ao recarregamento; CSAT não duplica. |
| Serviço do catálogo com diagnóstico e correção                    | Seleciona o fluxo do serviço, exige evidências, mantém a O.S. aberta entre etapas e conclui o processo após a correção. A automação de fechamento registra execução concluída.                |
| Entregas paralelas                                                | Fechar a O.S. principal gera duas O.S. complementares. A ocorrência permanece em execução até concluir ambas; o processo então termina.                                                       |
| Encaminhamento e retomada pelo responsável anterior               | Registra duas passagens de atendimento, impede o analista sem responsabilidade de encerrar e permite reassumir antes da conclusão.                                                            |
| Alteração simultânea                                              | A API responde HTTP 409 à versão desatualizada; o texto digitado permanece. O botão de atualização carrega a versão atual, conserva as evidências e permite concluir.                         |
| Agendar e remover agendamento                                     | Persiste o horário de Fortaleza convertido corretamente e preserva o prazo e a ausência de pausa do SLA.                                                                                      |
| Diagnóstico sem falha                                             | Encerra pelo caminho alternativo sem criar a etapa de correção. A tela de conclusão também é verificada em 390 × 844, sem transbordamento horizontal da página.                               |
| Alta prioridade atrasada com aprovação obrigatória                | Registra a solução como RESOLVIDA, mantém a ocorrência aberta e explica a dependência de aprovação da gestão, sem apresentar outro formulário de encerramento.                                |

O fluxo simples usa a definição oficial `AJUST_SIMPLES`. Os cenários sequencial e paralelo usam definições publicadas exclusivamente no banco descartável, para exercitar decisões, evidências obrigatórias, bifurcação e junção de entregas.

## Correções de usabilidade aplicadas

- O fechamento deixou de afirmar que haveria próximas etapas em todo caso. A tela distingue fluxo concluído de O.S. complementares pendentes e oferece links para essas entregas.
- A resolução dependente de aprovação agora explica o impedimento e preserva a consulta ao resultado e às anotações.
- Conflitos de atualização explicam que o rascunho foi preservado e oferecem **Atualizar dados mantendo rascunho**.
- Na abertura pelo analista, o campo de responsável começa com o próprio usuário e continua permitindo encaminhamento a outra pessoa.
- O catálogo informa que a escolha também determina as etapas do atendimento e suas evidências.
- A edição do analista não oferece mudança de prazo, que o servidor reserva à gestão. A tela orienta como solicitar essa alteração.
- O link de acessos técnicos do provedor passou a ocupar uma linha separada, corrigindo a junção visual com o nome do provedor.

## Avaliação técnica da operação

A sequência dos cenários testados é coerente: a ação principal acompanha o estado da O.S., as evidências aparecem na etapa correspondente, e concluir uma etapa não encerra prematuramente a O.S. O rascunho, as anotações e a passagem entre responsáveis ajudam a continuar o trabalho sem redigitar informações. A distinção entre uma O.S. concluída e o atendimento com entregas restantes ficou explícita.

Esta é uma avaliação técnica de usabilidade, com inspeção visual de capturas e automação do navegador. Não mede tempo de aprendizado ou satisfação de analistas reais. Para validar esses pontos, a próxima homologação deve observar analistas abrindo, encaminhando, concluindo e reabrindo um atendimento com seus serviços habituais.

## Execução e evidências

```bash
pnpm test:analyst:journey
```

Requer dependências do projeto instaladas, Prisma Client gerado, Docker e Chromium do Playwright. O comando cria PostgreSQL e Redis descartáveis com portas locais aleatórias, aplica migrations, prepara usuários fictícios, compila os serviços e executa os testes. Ao terminar, encerra esses servidores e remove seus contêineres, preservando os arquivos de evidência em `/tmp/ajust-analyst-journey.*`.

O teste possui proteção para executar apenas com adesão explícita (`E2E_ANALYST_JOURNEY=1`), banco local `ajust_ci` e tenant fictício `ci`. O CI também foi configurado para executar a jornada em seu banco de integração.

Execução final:

- Log: `/tmp/ajust-analyst-journey.dQOvJB/journey.log`.
- Capturas: `/tmp/ajust-analyst-journey.dQOvJB/browser/` — abertura, fechamento, diagnóstico, conclusão, entregas pendentes, celular e aprovação pendente.
- Logs de build e dos servidores: `/tmp/ajust-analyst-journey.dQOvJB/`.
- Lint de todos os pacotes: aprovado.
- Formatação do repositório: aprovada.
- Build do frontend com verificação TypeScript: aprovado.
- `git diff --check` e sintaxe do script Bash: aprovados.

Não houve alteração de registros do ambiente em uso nem publicação/deploy. As senhas demonstrativas existentes foram preservadas. O teste não certifica todos os serviços publicados no ambiente atual, a decisão de aprovação pela gestão, envio real de e-mail, integrações externas, anexos ou carga concorrente de produção.
