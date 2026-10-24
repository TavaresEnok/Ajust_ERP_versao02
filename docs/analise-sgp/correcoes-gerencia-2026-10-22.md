# Correções da gerência — 22/10/2026

## Entrega

- Saúde/performance por provedor usa o cliente vinculado à ocorrência como chave, com o nome do provedor da ocorrência como alternativa. Solicitantes não são tratados como provedores. Links abrem o cadastro correto do cliente.
- O filtro superior de período em Relatórios também se aplica à consulta de saúde por provedor. A consulta personalizada inferior continua independente.
- A API gerencial retorna `tmrHours`, `measuredClosed`, `slaPercentage`, `slaEvaluated` e `slaMet`. A média é ponderada pelas ordens com datas válidas; `updatedAt` não substitui resolução. Cancelamentos não entram como ativas nem conclusões.
- SLA percentual considera somente conclusões elegíveis com prazo e datas válidas. Sem denominador retorna `null`, exibido como **Sem base**, nunca 100% presumido. Não foram criadas políticas ou prazos retroativos.
- Indicadores gerenciais mantêm o recorte das O.S. **criadas no período** e sua situação atual, agora identificado na interface. Não equivalem a todas as entregas ocorridas no período nem ao backlog inteiro. O painel pessoal do analista mantém sua própria semântica documentada anteriormente.
- Equipe técnica mostra apenas usuários com perfil **Analista**. Contas administrativas e de clientes permanecem preservadas na administração de usuários. Há atalhos separados para administração e performance da equipe.
- A situação de acesso não é apresentada como disponibilidade operacional. Contadores da lista indicam sua base SGP; resolvidas contam como concluídas. O relatório de performance contempla as origens retornadas pelo ERP.

## Evidências

Na conferência real: 40 analistas exibidos; nenhum gestor ou cliente na tabela da equipe. Saúde separou Meganet, Homenet, Ecotelecom, Infotel, Ultranet e G5, além de grupos internos e de homologação existentes, que não são novos clientes cadastrados.

No recorte de 30 dias, média de resolução retornada: 37,9 horas, com 28 conclusões mensuráveis. Nenhuma conclusão tinha base elegível para o percentual de SLA nesse recorte: a interface mostra **Sem base**. Esses valores são uma fotografia da consulta, não metas ou tempo efetivamente trabalhado.

Testes da API: 452 aprovados, 11 já ignorados; rodada focal de relatórios/IAM: 24 aprovados. Conferência em navegador: equipe filtrada, atalho de performance, relatórios, dashboard e campos da API aprovados, sem exceções JavaScript. Typecheck de web/API aprovado. Formatação e verificação de espaços aprovadas. Lint sem erros nos componentes alterados, com aviso preexistente sobre `Date.now` durante renderização.

Não houve exclusão de contas, nova importação, ativação de analistas bloqueados ou alteração da porta 8071. Nenhuma política de segurança foi ampliada. Esta entrega não substitui a homologação de produção nem limpa automaticamente os registros nativos de teste existentes.
