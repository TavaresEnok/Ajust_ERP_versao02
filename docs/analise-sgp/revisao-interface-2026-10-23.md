# Revisão do protótipo integrado — 23/10/2026

Referência: HTML integrado de 2.635 linhas enviado pelo usuário, com painel, cofre, Ajustpedia, menus, formulários, busca, terminal e utilitários.

## Aplicado ao ERP

- Painel: cartões de prioridade com cores, três gráficos visíveis, total de ativas no centro do gráfico de distribuição, atalhos para conhecimento/cofre e fila paginada com indicação de atenção por O.S.
- Cofre: entrada em cartões de provedores, contagens reais de itens/categorias e alternância para tabela. Data da última alteração com tamanho menor e sem segundos. A navegação por categorias e as abas de acesso/orientações/histórico permanecem.
- Tema escuro como padrão para quem ainda não escolheu um tema; seleção manual continua persistida.
- Ajustpedia: oito artigos E2E removidos por correspondência exata de título e conteúdo; o artigo `59411729-3108-4b76-988c-eb6f6cd783a7` foi preservado sem modificar título ou comando. Três consultas curtas Huawei foram cadastradas com origem registrada na auditoria.

## Interações analisadas no HTML

Os gráficos do protótipo usam pontos e totais fixos; o ERP calcula aberturas, conclusões e pendências a partir das O.S. A troca de escopo consulta dados próprios ou da operação, e a paginação percorre a fila real. Cards de provedores usam contagens da API; não foi atribuída região, homologação ou SLA sem cadastro correspondente.

O terminal do HTML retorna textos predefinidos e o TOTP mostrado é aleatório. O cofre do ERP mantém geração TOTP pelo segredo criptografado já implementado. Uma integração de terminal exigiria execução remota real e constitui uma funcionalidade própria. Os formulários do ERP persistem no servidor, com autorização e histórico, em vez de alterar somente arrays no navegador. A renderização de artigos continua como texto/comandos para evitar executar HTML fornecido em conteúdo.

## Curadoria da Ajustpedia

- `display ip interface brief`: referência Huawei de interfaces IPv4 — https://info.support.huawei.com/hedex/api/pages/EDOC1000053358/YEF0907R/25/resources/en-us_cliref_0133018113.html
- `display arp`: referência Huawei ARP — https://info.support.huawei.com/hedex/api/pages/EDOC1100331440/AZM10131/04/resources/dc/display_arp.html
- `display ip routing-table`: referência Huawei de rotas — https://info.support.huawei.com/hedex/api/pages/EDOC1100362944/AZN04029/05/resources/command/yunshan/DISPLAYROUTE_1%28ROUTEOM%29.html

Backup recuperável das tabelas de artigos/tags antes da limpeza: `/tmp/ajust-pedia-cleanup.4FINAl/articles.dump`. Arquivo temporário com permissão restrita; exclusões registradas na auditoria. A sintaxe exata de parâmetros opcionais varia entre modelos/versões; foram cadastradas as consultas básicas sem parâmetros, sem execução em equipamentos.
