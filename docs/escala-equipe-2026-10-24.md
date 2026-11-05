# Escala de plantão — 24/10/2026

A página `/analista/plantao` e a correspondente da gerência focam apenas a programação diurna dos sábados, domingos e feriados. Os turnos fixos não são repetidos na lista. O menu usa o nome **Escala de plantão**.

## Uso

- A página consulta um período de 28 dias, mas lista somente sábados, domingos e feriados, mostrando a equipe diurna e se a data ainda aguarda programação.
- O card **Próximo feriado** procura, pelos próximos 365 dias, datas no calendário interno de SLA e feriados nomeados na escala. Não consulta calendário público; na base Ajust verificada, não há feriados futuros cadastrados.
- A navegação percorre períodos de quatro semanas ou permite selecionar uma data. Não há opção de semana completa nem filtro por turno.
- O filtro **Pendentes** fica junto aos controles da tabela/calendário. A visão alternativa agrupa somente as datas especiais por semana, sem células de dias úteis comuns.
- A tabela compacta destaca hoje, feriados, integrantes e situação. O analista pode filtrar **Apenas meus plantões** e abrir **Detalhes** para consultar as orientações completas.
- A configuração administrativa dos turnos padrão continua disponível para alimentar a cobertura da Agenda, mas essas equipes não são repetidas na tela de plantão.
- A gerência programa a equipe diurna de uma data especial, escolhe múltiplos integrantes por nome e faz trocas desmarcando quem sai e marcando quem entra. Para feriado local em dia útil, usa **Adicionar feriado**, escolhe a data e confirma o nome do feriado.
- A equipe noturna sempre segue a configuração fixa vigente, inclusive fins de semana e feriados.
- Remover a programação de uma data restaura o padrão: equipe diurna fixa nos dias úteis, ou pendente em fins de semana/feriados.
- O analista consulta a próxima data especial, pendências e histórico. Não recebe controles de edição.
- O editor mostra a quantidade real de plantões diurnos de cada integrante no período e permite ordenar por menor quantidade. A gerência continua escolhendo os nomes; essa contagem não representa horas trabalhadas ou disponibilidade.
- A Agenda mostra a equipe real diurna/noturna da data selecionada, junto aos compromissos. A disponibilidade informativa não bloqueia agendamento.

## Calendário para download

**Baixar calendário** gera um arquivo `.ics` com as datas diurnas programadas do período. Para o analista, **Baixar meus plantões** inclui somente suas alocações. Datas sem equipe e a demonstração não são exportadas.

O arquivo usa eventos de data inteira porque os horários dos turnos não foram informados. Inclui nomes e orientações, com escape e quebra de linhas conforme o [formato iCalendar](https://www.rfc-editor.org/rfc/rfc5545.html). O download é uma fotografia da escala naquele momento; alterações posteriores exigem novo download, sem assinatura de sincronização automática.

## Adaptação do protótipo visual

Foram aproveitados os cards de ação, filtros, visualização alternativa, status coloridos, avatares, seleção de integrantes e orientações. O tema e a sessão são os do ERP. A edição continua restrita à gerência e o turno noturno permanece fixo. Solicitação de permuta, distribuição automática e validação de jornadas sugeridas no protótipo não fazem parte desta revisão visual.

## Demonstração e dados reais

Enquanto não há programação real, a página abre diretamente a escala real, com as datas especiais pendentes. A demonstração ilustrativa segue disponível sob demanda no botão **Ver exemplo** e não grava alocações. Gestores podem configurar equipes padrão ou programar uma data especial. A equipe real precisa ser selecionada pela gerência, pois suas composições ainda não foram informadas.

Os horários dos turnos não foram presumidos. A página trata datas e equipes; horários dos trabalhos continuam na Agenda.

## Persistência e regras

- Modelos `TeamRosterPolicy` (padrão com vigência) e `TeamRosterDay` (equipe diurna programada para uma data), ambos vinculados à empresa Ajust.
- Feriados já presentes em `BusinessCalendarException` com `isWorkDay = false` são respeitados. Indicar feriado local na escala não modifica as políticas de SLA.
- API autenticada, consulta restrita aos perfis internos; alterações só para gerente e super_admin. A seleção aceita apenas integrantes internos ativos da mesma empresa.
- Versão esperada impede que uma edição desatualizada sobrescreva outra sem aviso.
- Alteração e auditoria `ROSTER_UPDATE` são gravadas na mesma transação, com responsável, data, estado anterior e novo. A interface consulta as últimas 20 alterações.
- Nenhuma O.S., ocorrência ou compromisso é criado automaticamente pela escala.
- A migração `20261024210000_team_roster` é aditiva. Backup anterior à migração: `/tmp/pre-team-roster-20261024.dump` no contêiner PostgreSQL.

## Verificação

Os testes de calendário cobrem dias úteis, fins de semana, feriado, troca de equipe, equipe explicitamente vazia e vigência. Os testes de autorização cobrem consulta interna e bloqueio de edição pelo analista.

O roteiro `node --env-file=.env scripts/check-team-roster.cjs` usa uma empresa temporária isolada e verifica UI → BFF → API → banco: configuração padrão, lista sem dias úteis, sábado com múltiplas pessoas, substituição, edição pelo calendário, filtros, orientações, exportação `.ics` por perfil, histórico, versões, rejeição de integrante externo, restauração e feriado local. Confere também a equipe real na Agenda e as duas visualizações em celular. Cadastros e registros de teste são removidos ao terminar.
