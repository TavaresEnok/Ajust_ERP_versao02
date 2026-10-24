# Consolidação dos perfis de acesso

Solicitação do dono da Ajust em 21/10/2026: remover os perfis Técnico e Leitura. Esta entrega substitui a relação de seis perfis registrada nas análises anteriores.

## Resultado aplicado

| Perfil ativo | Vínculos de usuário | Área |
| --- | ---: | --- |
| Super Admin | 1 | Gestão |
| Gerente | 2 | Gestão |
| Analista | 40 | Equipe |
| Cliente | 2 | Portal do cliente |

Os 39 vínculos antes classificados como Técnico foram migrados para Analista, incluindo Anderson Alves. Já existia um vínculo Analista. Não havia usuário com perfil Leitura: nenhuma conta recebeu acesso operacional por inferência a partir desse perfil.

Não foram excluídas pessoas, alteradas senhas ou ativadas contas bloqueadas. Anderson mantém seu login e a senha entregues anteriormente. Sessões anteriores dos usuários migrados foram revogadas: é necessário entrar novamente para iniciar a sessão com o perfil atual.

O ERP permanece com uma única empresa operadora, Ajust, e seis clientes/provedores; não foram criados tenants.

## O que foi ajustado

- Migração transacional `20261021220000_consolidate_access_profiles`: atualização dos vínculos, registro de auditoria por usuário, revogação de sessões afetadas e remoção das duas definições de perfil.
- Restrição no banco para os quatro códigos ativos, impedindo recriação dos perfis retirados por scripts antigos.
- Validação de perfil na autenticação/refresh e enum explícito na criação/alteração de usuários.
- Remoção dos dois perfis das opções de cadastro, tipos do frontend, menus/redirecionamentos e listas de autorização dos módulos.
- Seeds, testes e importador SGP ajustados para não recriar Técnico ou Leitura. Novos integrantes importados recebem perfil provisório Analista e continuam bloqueados até revisão, conforme a regra existente.
- Restrições exclusivas do papel Técnico removidas; os usuários migrados passam a seguir as regras existentes de Analista. Isso não lhes concede papel Gerente ou Super Admin.

## Compatibilidade com processos existentes

Definições publicadas e instâncias históricas não foram reescritas nem renumeradas. Uma adaptação somente na leitura traduz a permissão histórica Técnico para Analista e remove concessões históricas de Leitura sem promovê-las a operação. Essa projeção é aplicada aos modelos, rascunhos e consultas de execução.

Novas definições não podem incluir os perfis retirados. As referências restantes aos nomes antigos ficam restritas à compatibilidade histórica, testes negativos e migração; identificadores originais de técnicos do SGP e URLs antigas de equipe também são preservados para não romper rastreabilidade ou links. Nenhuma dessas referências recria um perfil de acesso.

## Preservação conferida

Foi salvo um snapshot privado antes da migração e feita comparação imediatamente depois. As contagens permaneceram iguais: 45 usuários, 168 O.S., 71 modelos, 149 instâncias, uma empresa operadora, seis clientes, oito notas, 425 credenciais e 205 eventos/comentários de O.S.

Fingerprints confirmaram que senhas/status/exclusão dos usuários, atribuições e estados das O.S., versões/definições de modelos e definições/estados das instâncias não mudaram na migração. As mudanças esperadas foram nos vínculos de perfil, sessões revogadas e auditoria. Os snapshots ficam fora do repositório e não contêm senhas legíveis.

Depois disso, os testes de interface criaram e removeram somente suas próprias notas temporárias, como nos testes anteriores.

## Verificações

- **474 testes unitários aprovados**: 443 API e 31 worker. Permanecem 11 testes e três suítes ignorados, que não são contados como aprovados.
- Typecheck API/frontend aprovado. ESLint dos arquivos envolvidos sem erros; há um aviso pré-existente de `setState` em efeito em `settings-pages.tsx`.
- Login real dos três acessos: Administração → Gerente, Anderson → Analista e Meganet → Cliente. Nenhuma senha foi substituída.
- Banco e API de funções conferidos. Cadastro recusou os dois perfis retirados com HTTP 400 sem criar usuário; formulário não oferece mais essas opções.
- Sessão de Anderson confirmada como Analista. Consultas gerenciais de usuários, empresas, auditoria, KPI e workflows continuam bloqueadas com HTTP 403.
- 68 modelos operacionais antigos foram lidos com sucesso e sem os perfis retirados nas permissões projetadas.
- Portal Meganet manteve vinte O.S. liberadas e o isolamento dos outros clientes/comentários internos. Regressão de notas também aprovada; os dados temporários foram removidos.
- O frontend foi reiniciado durante a validação para eliminar uma resposta desatualizada da camada de proxy; os testes passaram após o reinício.

Scripts de verificação: `scripts/check-four-profiles.cjs`, `scripts/check-review-access-notes.cjs` e `scripts/audit-access-profile-state.cjs`. Os dois primeiros usam um arquivo privado de credenciais informado por `ERP_REVIEW_ACCESS_FILE`; nunca versionar esse arquivo.

Esta entrega consolida os perfis. Não substitui os bloqueios de produção nem representa uma reformulação completa de todas as telas e permissões operacionais do Analista.
