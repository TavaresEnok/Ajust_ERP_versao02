# Migração cadastral Ajust → ERP

Executada em 20/10/2026 no banco do ambiente de trabalho, workspace **Ajust Demo** (`ajust-demo`). Não é um relatório de implantação em outro servidor.

## Resultado

| Cadastro                                        | Resultado                                        |
| ----------------------------------------------- | ------------------------------------------------ |
| Clientes                                        | 6 novos registros                                |
| Pessoas retornadas como técnicos no SGP         | 38 novos registros, com acesso bloqueado         |
| Contas operacionais                             | 2 identificadas e excluídas da equipe de pessoas |
| Novas O.S., ocorrências, contratos e financeiro | Nenhum                                           |
| Novos tenants/ambientes                         | Nenhum                                           |

Clientes importados: **60 — Meganet; 108 — Homenet; 53 — Ecotelecom; 89 — Infotel; 25 — Ultranet; 9 — G5 Jaboatão**. ID e CNPJ foram conferidos contra os seis pares explicitamente autorizados antes da gravação.

## Onde consultar

- **Operação → Provedores** (`/gerencia/provedores`): os seis clientes, busca por nome/CNPJ/ID SGP e detalhe do cadastro com contatos.
- **Operação → Equipe técnica** (`/gerencia/tecnicos`): pessoas migradas e integrantes que já existiam no ERP.
- A área **Empresas e tenants** continua representando ambientes de acesso, não os clientes da consultoria. Os seis provedores pertencem ao workspace Ajust, sem criar seis empresas de autenticação.

Foi criada a entidade `Customer`, isolada por tenant. A navegação de provedores foi ligada a esse cadastro; a listagem anterior consultava tenants. A consulta cadastral desta etapa é somente leitura pela interface, sem importação automática contínua.

## Campos dos clientes

Preservados: razão social original, CNPJ normalizado, tipo de pessoa, ID SGP, data cadastral original como texto, endereço (logradouro, número, complemento, bairro, cidade, UF e CEP) e listas de telefones, celulares e e-mails disponíveis. O nome de identificação do provedor é o informado pela Ajust; não substitui a razão social original.

Campos vazios permanecem vazios e aparecem como **não informado no SGP**. Não foram inventados e-mail, domínio, responsável técnico ou situação contratual. Contatos são os do cadastro da origem e ainda precisam de validação operacional.

**Não importados:** contratos, títulos, pagamentos, senhas, serviços de rede, credenciais, anexos, observações livres, O.S., ocorrências, comentários ou vínculos de atendimento. A consulta solicita omissão de contratos/títulos e uma lista explícita de campos impede sua persistência mesmo se retornarem na resposta.

## Equipe e acessos

O endpoint `/api/ura/tecnicos/` retornou **40 registros**, contendo apenas `id`, `username` e `nome`. Não fornece e-mail, situação ativa/inativa nem distingue analista de técnico. Portanto, os 38 cadastros são todas as pessoas retornadas por esse endpoint, **não uma confirmação de 38 colaboradores atualmente ativos nem de cobertura de usuários não listados por ele**.

Excluídos como pessoas:

- ID 23 — `Chamados_em_Espera`: fila operacional, sem nome de pessoa.
- ID 37 — `sistema_os`: conta de sistema.

Para cada pessoa: nome original, ID/login de origem, vínculo apenas com Ajust e metadados de pendência. O papel técnico básico é **provisório**, não uma classificação confirmada do cargo original; a equipe exibe “Analista/técnico · confirmar função”.

Todos os 38 acessos foram criados como **BLOCKED**. Não foram enviados convites ou e-mails, copiados acessos antigos, concedidos perfis de gestor/admin nem distribuída senha padrão. O identificador de e-mail usa domínio reservado `.invalid`, está marcado como substituto técnico e não é apresentado como contato real na equipe. Hashes de senhas aleatórias não recuperáveis foram gerados, sem preservar ou fornecer as senhas.

Antes de liberar acesso: confirmar a identidade e se a pessoa ainda integra a equipe; cadastrar e-mail real; definir analista/técnico e setor; configurar uma credencial individual pelo fluxo administrativo existente. A classificação pendente de origem permanece registrada como contexto da migração.

### Possível correspondência com cadastro local

Na conferência final havia um usuário ERP chamado **Enok**, além do cadastro SGP **Enok Tavares**. O login de origem coincide com a parte anterior ao `@` do e-mail local, mas a API não fornece e-mail para confirmar a identidade. Os dois foram preservados separadamente; não foram sobrescritos senha, status ou permissões do acesso local. Confirmar se representam a mesma pessoa antes de qualquer unificação. A idempotência por ID SGP não equivale a uma deduplicação de identidades entre sistemas sem dados suficientes.

## Segurança e repetição

Importador: `scripts/import-sgp-registry.ts`, comando `pnpm db:import:sgp:registry`. Simulação por padrão; gravação somente com `--apply`. A credencial vem de `SGP_TOKEN` no ambiente e não é persistida pelo importador. As únicas leituras remotas são os endpoints cadastrais de clientes e técnicos; nenhuma escrita foi feita no SGP.

Uma transação serializável grava os cadastros e auditorias. Chaves por origem/ID e CNPJ impedem duplicação. Conflitos de identidade interrompem a transação; registros anteriores não são sobrescritos por uma nova execução. Repetição real com `--apply` retornou **ALREADY_IMPORTED**, sem novos clientes, pessoas ou auditorias da migração.

## Verificações realizadas

- 10 testes passando, incluindo sanitização, identidade, exclusão de contas operacionais, isolamento de workspace e importação/idempotência em PostgreSQL com rollback do cenário de teste.
- Typecheck API e web; lint dos arquivos alterados sem erros; schema Prisma sem diferenças em relação ao banco após a migration.
- Navegador autenticado: lista dos seis clientes, detalhe da Meganet e equipe; APIs retornaram 200; 38 pessoas de origem SGP, todas bloqueadas e com classificação pendente. Nenhum erro JavaScript capturado nesse percurso.
- Antes e depois: **43 O.S., 11 ocorrências, 80 comentários de O.S., 1 processo de atendimento e 3 modelos de processo**. Foi comparado também o conteúdo integral desses registros por digest, sem alterações.
- O piloto de atendimento criado anteriormente foi preservado como estava; esta execução não o vinculou automaticamente ao novo cadastro de cliente e não migrou mais atendimento algum.

Próximas etapas de O.S., ocorrências, workflows e demais informações aguardam nova definição da Ajust; não fazem parte desta migração cadastral.
