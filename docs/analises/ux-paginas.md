# Auditoria de Experiência do Usuário (UX) e Interface · Ajust ERP

> **Documento gerado em:** Novembro/2026  
> **Ambiente auditado:** `https://erp.ajustconsulting.com.br` (Next.js 16 / React 19)  
> **Escopo:** Telas da Gerência e do Analista, navegação global, responsividade móvel (390 px) e modos claro/escuro.  
> **Regra de execução:** Somente leitura; nenhuma alteração em código ou dados foi aplicada.

---

## 1. Metodologia e Padrão de Referência

A auditoria teve como régua de excelência a página reorganizada **`/gerencia/workflows`** ([`workflow-designer.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/workflow-designer.tsx)), que estabeleceu o novo padrão de usabilidade e produtividade operacional do Ajust ERP.

### Os 5 Pilares do Padrão de Referência (`/gerencia/workflows`)

1. **Rótulos acima dos campos:** Campos com rótulos destacados (`<label className="flex flex-col gap-1.5 font-medium">`), posicionados consistentemente acima do controle de entrada, sem estilos opacos ou itálicos que prejudiquem a legibilidade.
2. **Ações da página em barra única e fixa:** Barra consolidada (`<header className="panel sticky top-2 z-20 flex flex-wrap items-center gap-3 p-3">`) que reúne título, identificador, badge de status de ciclo de vida e botões de ação primária e secundária em um único ponto visual.
3. **Proteção ativa contra perda de dados:** Monitoramento de estado sujo (`dirty tracking`) com escuta a `beforeunload` e modal de confirmação ao tentar sair ou navegar sem salvar alterações.
4. **Confirmação explícita em ações irreversíveis:** Modais padronizados (`<Dialog>`) com contexto objetivo, alerta de impacto operacional e botão de ação destrutiva estilizado (`variant="destructive"`), eliminando exclusões ou conclusões acidentais.
5. **Termos simples e sem redundâncias:** Linguagem humana orientada à rotina de telecom e suporte (ex.: *"Etapa"*, *"Alguém executa e escolhe o resultado"*), sem jargões de infraestrutura/banco (UUIDs, enums técnicos brutos, disclaimers de debug) e sem repetição de dados em cabeçalhos, filtros e tabelas.

```
+-----------------------------------------------------------------------------------------+
|                                PADRÃO BENCHMARK (/gerencia/workflows)                   |
+-----------------------------------------------------------------------------------------+
| [← Voltar]  Nome do Fluxo [input]    [Publicado v1]    |  [Validar] [Simular] [Salvar]   |
+-----------------------------------------------------------------------------------------+
|  [Canvas / Diagrama Visual das Etapas]   |  Painel Lateral da Etapa Selecionada         |
|                                          |  • Rótulo acima: Nome da etapa [input]       |
|                                          |  • Rótulo acima: Responsável [select]        |
|                                          |  • Proteção: dirty tracking + beforeunload   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Resumo Executivo dos Achados por Impacto

A inspeção identificou desvios em três categorias de severidade:

| Severidade | Quantidade | Principais Sintomas |
| :--- | :---: | :--- |
| **Alto Impacto** | **5** | Menu com rotas erradas impedindo acesso da gerência ao Cofre e Ajustpedia; formulários sem proteção contra perda de dados; encerramento de O.S. em lote sem diálogo modal confirmatório; solicitação de digitação de UUID manual para consultar sessões de usuários. |
| **Médio Impacto** | **14** | Ações de página fragmentadas em 3 ou 4 sub-barras empilhadas; sobrescrita global de rótulos para opacos/cinzas; avisos técnicos de desenvolvedor exibidos em tela; tabelas que quebram a navegação no celular (390 px); botões com comportamentos imprevisíveis (ex.: alternar escala para dados falsos de demonstração em produção). |
| **Baixo Impacto** | **9** | Tipografia microscópica (`text-[9px]` e `text-[10px]`); redundância de termos em cartões de métricas (selo literal *"ERP"*); contraste deficiente de cabeçalhos escuros fixos no tema claro; badges com nomes de enum técnico bruto (`AG_TERCEIROS`, `CONSULTORIA_GERAL`). |

---

## 3. Achados de Alto Impacto

### [ALTO-01] Rotas de Menu da Gerência Quebradas para Cofre, Ajustpedia e Notas
- **Componente:** [`apps/web/lib/navigation.ts`](file:///home/app/projects/Ajust_ERP/apps/web/lib/navigation.ts#L149-L165) e [`apps/web/components/erp/app-shell.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/app-shell.tsx)
- **Rotas afetadas:** Menu lateral da gerência → Ajustpedia, Cofre de credenciais, Minhas notas.
- **Desvio do padrão:** No array de navegação do gerente (`managerNav`), os links estão fixados como `/analista/ajustpedia`, `/analista/credenciais` e `/analista/notas`. Quando um gestor clica em qualquer um desses itens, o middleware de portal em [`apps/web/proxy.ts`](file:///home/app/projects/Ajust_ERP/apps/web/proxy.ts) intercepta a rota por disparidade de portal (`role: gerente` tentando acessar `/analista/*`) e redireciona o usuário compulsoriamente de volta para o dashboard (`/gerencia`). O gestor fica impossibilitado de abrir o cofre, a base técnica ou suas notas a partir do menu principal.
- **Correção sugerida:** Em `navigation.ts`, apontar os itens do menu da gerência para `/gerencia/ajustpedia`, `/gerencia/credenciais` e `/gerencia/notas`, ou usar resolução dinâmica de rota baseada no perfil ativo.

---

### [ALTO-02] Perda de Dados em Formulários de Abertura e Edição sem `dirty tracking` nem `beforeunload`
- **Componente:** [`apps/web/components/erp/contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/contract-form.tsx#L250-L310), [`attendance-intake.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/attendance-intake.tsx) e [`record-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/record-workspace.tsx)
- **Rotas afetadas:** `/gerencia/ordens/nova`, `/gerencia/ordens/[id]` (aba Editar), `/gerencia/ocorrencias/[id]` (aba Editar).
- **Desvio do padrão:** Em contraste com [`workflow-designer.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/workflow-designer.tsx#L359-L368), que monitora alterações pendentes e registra listener de `beforeunload`, o formulário universal `ContractForm` não possui controle de rascunho sujo. Se um usuário preencher um atendimento extenso com múltiplos parágrafos e clicar acidentalmente em qualquer link do menu lateral ou fechar a janela, todos os dados são descartados instantaneamente sem aviso de confirmação.
- **Correção sugerida:** Implementar estado `isDirty` comparando valores atuais com iniciais e anexar listener de `beforeunload`, bloqueando a navegação interna e externa com diálogo confirmatório.

---

### [ALTO-03] Encerramento em Lote de O.S. sem Confirmação Modal Segura
- **Componente:** [`apps/web/components/erp/occurrence-attendance.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/occurrence-attendance.tsx#L149-L200)
- **Rota afetada:** `/gerencia/ocorrencias/[id]` (Detalhamento do atendimento)
- **Desvio do padrão:** O encerramento da ocorrência expande um formulário inline com o botão *"Confirmar conclusão"*. Se a ocorrência contiver múltiplas ordens de serviço pendentes (ex.: 3 ou 5 O.S.), clicar no botão encerra irreversivelmente todas as ordens de serviço filhas de uma única vez no backend sem um diálogo modal `<Dialog>` de parada obrigatória e sem exigir confirmação explícita de cada entrega finalizada.
- **Correção sugerida:** Envolver a ação de encerramento em um `<Dialog>` modal destrutivo listando os protocolos das O.S. impactadas e exigindo checkbox de validação para cada uma antes de liberar a conclusão.

---

### [ALTO-04] Consulta de Sessões Exigindo Digitação Manual de UUID do Usuário
- **Componente:** [`apps/web/components/erp/security-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/security-workspace.tsx#L80-L100)
- **Rota afetada:** `/gerencia/seguranca` (Sessões e segurança)
- **Desvio do padrão:** Para que o gestor consulte as sessões ativas de um colaborador da equipe, o formulário exibe um campo com rótulo literal *"UUID do colaborador"* (`type: "uuid"`). O gestor é obrigado a localizar no banco de dados ou inspecionar requisições de rede para obter um identificador interno hexadecimal (ex.: `c2a1e847-8173-4e89-...`) e colá-lo no campo. Isso viola completamente a diretriz de termos simples e abstração técnica.
- **Correção sugerida:** Substituir o campo de texto puro com validação de UUID por um combobox com busca de colaboradores pelo nome e avatar ([`ReferenceField`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reference-field.tsx) com endpoint `/calendar/users` ou `/technicians`).

---

### [ALTO-05] Botão de Simulação de Dados Falsos ("Ver exemplo") em Produção na Escala de Plantão
- **Componente:** [`apps/web/components/erp/team-roster.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/team-roster.tsx#L776-L787)
- **Rota afetada:** `/gerencia/plantao` (Escala de plantão)
- **Desvio do padrão:** No cabeçalho da página de escala real de plantão, há um botão de variante neutra *"Ver exemplo"*. Ao ser clicado, a página substitui instantaneamente a escala operacional real por um mock em memória com nomes fictícios ("Analista noturno A", "Cesar", "Laura"), sem nenhuma faixa destacada de aviso de modo de demonstração. Um gestor pode facilmente acreditar que está editando a escala de sua equipe e perder tempo alterando registros fictícios que não persistem no banco.
- **Correção sugerida:** Mover o modo demonstrativo para documentação/onboarding ou exibir banner persistente de alerta com borda amarela destacando *"Modo Exemplo Ativo · Nenhuma alteração será salva"*.

---

## 4. Achados de Médio Impacto

### [MED-01] Fragmentação Excessiva de Ações e Filtros em Barras Empilhadas
- **Componente:** [`apps/web/components/erp/orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx#L400-L540)
- **Rota afetada:** `/gerencia/ordens` e `/analista/ordens`
- **Desvio do padrão:** A página possui quatro barras horizontais empilhadas verticalmente: (1) cabeçalho de página com links e botões soltos; (2) barra de situação (Pendentes, Concluídas, Todas); (3) barra de prazos (Todas, Atrasadas, Vencem hoje, Pausadas); (4) barra de busca por texto, select de status e botão de layout. No padrão de referência (`/gerencia/workflows`), existe apenas uma barra consolidada.
- **Impacto no Celular (390 px):** As 4 barras se desdobram em mais de 8 linhas verticais de botões, ocupando mais de 600 px de altura e empurrando a listagem de atendimentos para fora da primeira dobra da tela.
- **Correção sugerida:** Consolidar a navegação em uma única barra superior com abas deslizantes horizontais e agrupar filtros secundários em um painel colapsável de filtros avançados.

---

### [MED-02] Sobrescrita Global Forçando Rótulos Opacos e Desbotados
- **Componente:** [`apps/web/components/erp/contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/contract-form.tsx#L114)
- **Rotas afetadas:** Todas as telas com `ContractFields` (Abertura de O.S., Edição de Ocorrências, Políticas de SLA).
- **Desvio do padrão:** A classe utilitária do container do formulário aplica compulsoriamente: `[&_[data-slot=field-label]]:font-normal [&_[data-slot=field-label]]:text-muted-foreground`. Isso reduz a opacidade dos rótulos e os torna finos e desbotados, prejudicando o contraste em monitores de baixa fidelidade e sob luz solar, em desacordo com o padrão benchmark de rótulos visíveis e semititulares.
- **Correção sugerida:** Remover a regra de sobrescrita e permitir que `FieldLabel` herde a tipografia seminegrito padrão do design system (`font-medium text-foreground text-xs`).

---

### [MED-03] Disclaimers Técnicos de Desenvolvedor Exibidos na Interface Final
- **Componentes:** [`contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/contract-form.tsx#L293-L296), [`settings-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/settings-pages.tsx#L165-L168) e [`reports-page.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-page.tsx#L165-L170)
- **Rotas afetadas:** Rodapé de formulários, `/gerencia/configuracoes/preferencias` e `/gerencia/relatorios`.
- **Desvio do padrão:** Textos que parecem anotações de pull request ou mensagens de arquitetura backend são expostos aos usuários em microtipografia. Exemplos reais:
  * *"A alteração só será confirmada após a resposta do servidor."*
  * *"Tema e densidade são preferências da interface. O backend original não oferece contrato de preferências pessoais, idioma ou formato de data."*
  * *"O ERP valida a transição e a versão atual."*
- **Correção sugerida:** Suprimir os disclaimers técnicos que não agregam valor à operação e manter apenas mensagens de status reativas com sonner toasts após a execução.

---

### [MED-04] Roster e Calendário com Quebra Desordenada no Celular (390 px)
- **Componente:** [`apps/web/components/erp/team-roster.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/team-roster.tsx#L765-L820) e [`calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx#L198-L245)
- **Rotas afetadas:** `/gerencia/plantao` e `/gerencia/agenda`
- **Desvio do padrão:** Os controles de navegação de semanas e meses (botões Anterior, Próximo, Hoje, Seletor de Modo Tabela/Cartões/Mês) não possuem regras de flex-wrap adequadas. Em telas de 390 px, eles se partem em 3 linhas assimétricas, fazendo com que o botão "Hoje" fique desalinhado e sobreponha o seletor de visualizações.
- **Correção sugerida:** Criar container com barra de rolagem horizontal nativa para as pílulas de visualização e fixar a navegação temporal em uma linha dedicada de altura uniforme.

---

### [MED-05] Tabstrip Sobrecarregada com 10 Abas no Detalhe da O.S.
- **Componente:** [`apps/web/components/erp/record-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/record-workspace.tsx#L113-L125)
- **Rota afetada:** `/gerencia/ordens/[id]`
- **Desvio do padrão:** O workspace do registro da O.S. renderiza simultaneamente: `['Encerramento', 'Anotações', 'Editar', 'Resumo', 'Transição', 'Aprovações', 'Trabalho', 'SLA', 'Anexos', 'Histórico']`. Há redundância conceitual flagrante: *Encerramento*, *Transição* e *Trabalho* realizam variações da mesma ação (avançar status ou registrar conclusão).
- **Impacto no Celular (390 px):** A barra de abas quebra em três linhas verticais irregulares, obscurecendo o conteúdo do chamado.
- **Correção sugerida:** Agrupar em 4 abas estruturadas: *Atendimento* (trabalho + encerramento), *Anotações & Histórico*, *Anexos* e *Dados da O.S.* (resumo + edição).

---

### [MED-06] Inversão de Hierarquia Visual no Catálogo de Serviços
- **Componente:** [`apps/web/components/erp/service-types-analytics.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/service-types-analytics.tsx#L120-L135)
- **Rota afetada:** `/gerencia/servicos`
- **Desvio do padrão:** Ao acessar `/gerencia/servicos`, a tela abre por padrão a aba de *Análise de tipos de serviço* (relatórios e gráficos de volume) em vez do catálogo de serviços em si. Além disso, a barra de navegação entre abas é renderizada acima do título `PageHeading`, rompendo a estrutura espacial comum de todas as páginas do ERP.
- **Correção sugerida:** Mover a barra de abas para dentro do fluxo padrão abaixo do `PageHeading` e definir a aba do catálogo de serviços ativos como padrão para a gerência.

---

### [MED-07] Herói Escuro Rígido na Ajustpedia sem Suporte ao Tema Claro
- **Componente:** [`apps/web/components/erp/knowledge-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/knowledge-pages.tsx#L185-L232)
- **Rota afetada:** `/gerencia/ajustpedia` e `/analista/ajustpedia`
- **Desvio do padrão:** O cabeçalho de destaque da Ajustpedia utiliza classes com cores absolutas estáticas (`bg-[#0b101b]`, `border-white/10`, `text-white`, `text-slate-400`). No Modo Claro, o elemento exibe um bloco escuro pesado e dissonante em relação ao restante do layout claro e limpo do ERP.
- **Correção sugerida:** Substituir cores estáticas por tokens semânticos do tema: `bg-card border-border text-foreground text-muted-foreground`.

---

### [MED-08] Botão "Carregar serviços padrão" com Texto de Execução Confuso
- **Componente:** [`apps/web/components/erp/catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx#L202-L212)
- **Rota afetada:** `/gerencia/servicos` (Catálogo)
- **Desvio do padrão:** O gatilho exibe a descrição técnica: *"Solicitar ao ERP a criação dos serviços padrão. A aplicação depende das regras do servidor."* Essa mensagem gera hesitação no gestor quanto ao risco de sobrescrever serviços existentes ou duplicar registros.
- **Correção sugerida:** Alterar o texto para linguagem clara: *"Carregar modelos sugeridos de serviços para telecom e suporte. Não altera itens já criados."*

---

### [MED-09] Falta de Busca, Filtros e Paginação na Central de Ocorrências
- **Componente:** [`apps/web/components/erp/calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx#L495-L566)
- **Rota afetada:** `/gerencia/ocorrencias`
- **Desvio do padrão:** A página principal de ocorrências não disponibiliza campo de pesquisa rápida, filtro por provedor ou status, nem controle de paginação, exibindo uma tabela estática sem a flexibilidade da tela de ordens de serviço.
- **Correção sugerida:** Implementar barra de busca unificada e filtro por status idênticos aos de `/gerencia/ordens`.

---

### [MED-10] Estilo Inadequado de `<select>` Aplicado a `<textarea>` de Fechamento
- **Componente:** [`apps/web/components/erp/occurrence-attendance.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/occurrence-attendance.tsx#L163)
- **Rota afetada:** `/gerencia/ocorrencias/[id]`
- **Desvio do padrão:** O campo de texto para justificativa de conclusão da ocorrência utiliza a classe CSS `native-select` em uma tag `<textarea>` (`className="native-select min-h-24 w-full"`). O elemento herda setas e comportamentos visuais de select de dropdown, resultando em artefatos visuais no navegador.
- **Correção sugerida:** Substituir pela classe apropriada `native-input` ou pelo componente `<Textarea>` do design system.

---

### [MED-11] Alerta Permanente de SLA Não Homologado em Políticas de SLA
- **Componente:** [`apps/web/components/erp/catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx#L214-L220)
- **Rota afetada:** `/gerencia/politicas-sla`
- **Desvio do padrão:** Um banner de aviso fixo adverte: *"SLA contratual pendente de configuração. Defina as políticas da Ajust antes de usar os indicadores como compromisso contratual."* O aviso é renderizado incondicionalmente, mesmo quando o tenant já possui todas as políticas cadastradas e ativas.
- **Correção sugerida:** Condicionar a exibição do banner ao estado real da consulta (`policies.length === 0`).

---

### [MED-12] Links de Navegação Espalhados no Cabeçalho de Detalhes do Provedor
- **Componente:** [`apps/web/components/erp/customer-directory.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/customer-directory.tsx#L143-L164)
- **Rota afetada:** `/gerencia/provedores/[id]`
- **Desvio do padrão:** Na visão do provedor, quatro links e botões soltos (`OrderForm`, "Todas as O.S.", "Topologia de rede", "Acessos e orientações técnicas") flutuam no cabeçalho em vez de compor uma barra de ações unificada.
- **Correção sugerida:** Organizar os links como botões compactos em uma barra de ações contextual consolidada no topo da ficha do provedor.

---

### [MED-13] Área Administrativa Poluindo a Tela de Configurações Pessoais
- **Componente:** [`apps/web/components/erp/settings-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/settings-pages.tsx#L63-L101)
- **Rota afetada:** `/gerencia/configuracoes`
- **Desvio do padrão:** Antes de apresentar as opções de configuração do usuário (perfil, preferências, senha), a página exibe uma grade de cartões de alto nível administrativo misturando rotas de sistema ("Diagnóstico em tempo real", "Configurações e snapshots", "Integração IXC").
- **Correção sugerida:** Separar a administração global do sistema em menu dedicado de Governança/Configurações da Empresa e manter `/gerencia/configuracoes` focado exclusivamente em preferências de conta e sessão.

---

### [MED-14] Ausência de Destaque para Status Crítico de SLA no Mobile
- **Componente:** [`apps/web/components/erp/sla-monitor.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-monitor.tsx#L180-L215)
- **Rota afetada:** `/gerencia/sla` (Prazos da equipe)
- **Desvio do padrão:** A tabela de acompanhamento de prazos possui 7 colunas em largura total. Em 390 px, a coluna de situação de atraso/pausa fica oculta além da rolagem horizontal, impedindo que o analista de plantão veja imediatamente ordens vencidas sem arrastar a tela.
- **Correção sugerida:** Implementar layout em cartões empilhados com borda colorida destacada (vermelho para atrasadas, amarelo para vencimento em 2h) em telas menores que 640 px.

---

## 5. Achados de Baixo Impacto

### [BAIX-01] Tipografia Microscópica Inacessível (`text-[9px]` e `text-[10px]`)
- **Arquivos:** [`orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx#L737), [`calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx#L548), [`people-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/people-pages.tsx#L315) e [`credentials-vault.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/credentials-vault.tsx#L589)
- **Problema:** Múltiplos identificadores de protocolo, contadores de itens e rótulos secundários utilizam fontes de 9 px e 10 px. Segundo as diretrizes de acessibilidade WCAG 2.1 e legibilidade móvel, fontes abaixo de 11 px (0.75rem) causam fadiga visual e falhas de leitura em smartphones.
- **Correção:** Estabelecer como tamanho mínimo universal `text-xs` (12 px).

---

### [BAIX-02] Selo Literal de Mudança "ERP" em Cartões de Métrica
- **Arquivo:** [`apps/web/components/erp/reports-page.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-page.tsx#L208)
- **Problema:** Os cartões de métrica exibem a tag `change="ERP"`. Essa palavra não indica variação temporal, percentual ou sentido da métrica (positiva/negativa), gerando ruído visual.
- **Correção:** Substituir por comparativo útil (ex.: *"vs. período anterior"* ou *"fila em aberto"*).

---

### [BAIX-03] Repetição Textual de Instruções de Fuso Horário
- **Arquivos:** [`calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx#L190), [`sla-monitor.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-monitor.tsx#L134) e [`analyst-dashboard.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/analyst-dashboard.tsx#L217)
- **Problema:** A frase *"Horário de Fortaleza"* ou *"Os horários seguem o fuso de Fortaleza"* é repetida no subtítulo de praticamente todas as seções operacionais.
- **Correção:** Exibir indicador discreto de fuso horário apenas na barra de status superior ou rodapé global (`UTC-3 · Fortaleza`).

---

### [BAIX-04] Rótulos de Enums Técnicos Brutos sem Tradução Amigável
- **Arquivos:** [`order-board.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/order-board.tsx), [`orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx#L874) e [`record-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/record-workspace.tsx)
- **Problema:** Badges exibem chaves cruas de sistema em alguns pontos: `CONSULTORIA_GERAL`, `AG_TERCEIROS`, `AG_CAMPO`, `BGP_ROTEAMENTO`.
- **Correção:** Passar todos os valores pelo mapa padronizado de termos amigáveis (`orderTypes[key]`).

---

### [BAIX-05] Contraste de Bordas em Cartões no Modo Escuro
- **Arquivos:** Vários componentes com classes `border-border`.
- **Problema:** Em algumas telas (ex.: cartões de provedores do cofre e grade de relatórios), as bordas `border-border` no tema escuro possuem contraste reduzido em relação ao fundo `bg-card`, dificultando a delimitação dos cartões.
- **Correção:** Utilizar `border-border/80 hover:border-primary/50` para reforçar a delimitação e interatividade.

---

### [BAIX-06] Indicadores de Contagem em Listas sem Formatação Numérica Padrão
- **Arquivos:** [`customer-directory.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/customer-directory.tsx#L186) e [`knowledge-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/knowledge-pages.tsx#L275)
- **Problema:** Números de contagem não possuem padding ou formatação monetária/cardinal consistente (ex.: exibe "1" enquanto o padrão métrico do sistema exibe "01").
- **Correção:** Padronizar formatação numérica com `padStart(2, '0')` ou `Intl.NumberFormat`.

---

### [BAIX-07] Campo de Busca de Integrante Excessivamente Estreito
- **Arquivo:** [`apps/web/components/erp/people-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/people-pages.tsx#L458)
- **Problema:** O input de busca rápida de integrantes da equipe técnica possui largura fixa de `w-36` (144 px), cortando termos buscados mesmo quando há espaço abundante disponível na barra.
- **Correção:** Ajustar para `w-56 sm:w-72` com comportamento responsivo flexível.

---

### [BAIX-08] Botões de Ação na Tabela de Calendário Comercial sem Ícones
- **Arquivo:** [`apps/web/components/erp/sla-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-workspace.tsx#L164-L178)
- **Problema:** Os botões de *"Editar"* e *"Remover"* política de SLA são renderizados como texto puro em variante `ghost`, contrastando com a identidade iconográfica adotada no restante do sistema.
- **Correção:** Incluir ícones sutis (`Pencil` e `Trash2`) com variantes `variant="ghost" size="sm"`.

---

### [BAIX-09] Botão "Desfazer" na Seleção de Catálogo sem Tecla de Atalho
- **Arquivo:** [`apps/web/components/erp/order-contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/order-contract-form.tsx#L136-L144)
- **Problema:** A opção de desfazer o autopreenchimento de catálogo é muito útil, mas o botão fica embutido numa linha de texto secundário sem foco automático nem atalho de teclado (`Ctrl+Z`).
- **Correção:** Adicionar suporte ao evento de atalho de teclado e destacar o botão como ação complementar.

---

## 6. Auditoria Sistemática por Página

Abaixo está a análise individualizada de cada uma das páginas que compõem os menus da gerência e do analista, com evidências visuais registradas na auditoria.

---

### 6.1 Página de Referência: Fluxos de Atendimento (`/gerencia/workflows`)
- **Componente Principal:** [`apps/web/components/erp/workflow-designer.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/workflow-designer.tsx)
- **Status de Conformidade:** **100% aderente (Benchmark)**
- **Características:** Barra única fixa, rótulos acima dos campos, proteção ativa com aviso antes de perder alterações (`dirty tracking`), modal `<Dialog>` de confirmação para exclusão e publicação, vocabulário humanizado sem termos técnicos de infraestrutura.
- **Evidências:**
  * Desktop (1280x800): ![Workflows Desktop](prints/01-workflows-referencia-desktop.png)
  * Mobile (390x844): ![Workflows Mobile](prints/01-workflows-referencia-mobile.png)
  * Modo Escuro: ![Workflows Dark](prints/01-workflows-referencia-dark.png)

---

### 6.2 Ordens de Serviço · Gerência (`/gerencia/ordens`)
- **Componente Principal:** [`apps/web/components/erp/orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx) e [`order-board.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/order-board.tsx)
- **Desvios:** Quatro barras de ação e filtros empilhadas; métricas com texto secundário repetido; quebra desordenada de botões no celular; ausência de barra unificada de comandos.
- **Evidências:**
  * Desktop: ![Ordens Gerência Desktop](prints/02-ordens-gerencia-desktop.png)
  * Mobile: ![Ordens Gerência Mobile](prints/02-ordens-gerencia-mobile.png)
  * Modo Escuro: ![Ordens Gerência Dark](prints/02-ordens-gerencia-dark.png)
- **Correção sugerida:** Unificar os filtros de situação e prazo em um controle segmentado único e adotar barra de ações consolidada igual ao benchmark.

---

### 6.3 Ordens de Serviço · Analista (`/analista/ordens`)
- **Componente Principal:** [`apps/web/components/erp/orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx) e [`analyst-order-work.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/analyst-order-work.tsx)
- **Desvios:** Alternância entre "Minhas ordens" e "Todas da Ajust" gera duplicidade de controles em relação aos filtros de prazo; microtipografia nos identificadores de O.S. (`text-[9px]`).
- **Evidências:**
  * Desktop: ![Ordens Analista Desktop](prints/03-ordens-analista-desktop.png)
  * Mobile: ![Ordens Analista Mobile](prints/03-ordens-analista-mobile.png)
  * Modo Escuro: ![Ordens Analista Dark](prints/03-ordens-analista-dark.png)
- **Correção sugerida:** Integrar o seletor de escopo em abas limpas no topo da listagem e padronizar identificadores para `text-xs font-semibold`.

---

### 6.4 Abertura de Atendimento (`/gerencia/ordens/nova`)
- **Componente Principal:** [`apps/web/components/erp/attendance-intake.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/attendance-intake.tsx) e [`order-contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/order-contract-form.tsx)
- **Desvios:** Falta de `beforeunload` para resguardar texto digitado; rótulos de campos estilizados em cinza claro opaco; disclaimer técnico no rodapé (*"A alteração só será confirmada após a resposta do servidor"*).
- **Evidências:**
  * Desktop: ![Abertura Desktop](prints/04-abertura-atendimento-desktop.png)
  * Mobile: ![Abertura Mobile](prints/04-abertura-atendimento-mobile.png)
  * Modo Escuro: ![Abertura Dark](prints/04-abertura-atendimento-dark.png)
- **Correção sugerida:** Ativar proteção contra fechamento com dados pendentes e elevar o contraste dos rótulos para `font-medium text-foreground`.

---

### 6.5 Ocorrências (`/gerencia/ocorrencias` e `/gerencia/ocorrencias/[id]`)
- **Componente Principal:** [`apps/web/components/erp/calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx) e [`occurrence-attendance.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/occurrence-attendance.tsx)
- **Desvios:** Ausência de busca e paginação na lista de ocorrências; encerramento em lote de ordens pendentes sem confirmação modal; uso de classe `native-select` em `<textarea>`.
- **Evidências:**
  * Desktop: ![Ocorrências Desktop](prints/05-ocorrencias-desktop.png)
  * Mobile: ![Ocorrências Mobile](prints/05-ocorrencias-mobile.png)
  * Modo Escuro: ![Ocorrências Dark](prints/05-ocorrencias-dark.png)
- **Correção sugerida:** Adicionar busca por provedor na listagem e proteger o encerramento em lote com diálogo confirmatório detalhado.

---

### 6.6 Agenda (`/gerencia/agenda`)
- **Componente Principal:** [`apps/web/components/erp/calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx) e [`calendar-board.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-board.tsx)
- **Desvios:** No celular (390 px), os botões de navegação do mês e as opções Mês/Lista/Dia/Equipe colapsam de maneira desordenada; links e botão de novo compromisso espalhados fora de barra unificada.
- **Evidências:**
  * Desktop: ![Agenda Desktop](prints/06-agenda-desktop.png)
  * Mobile: ![Agenda Mobile](prints/06-agenda-mobile.png)
  * Modo Escuro: ![Agenda Dark](prints/06-agenda-dark.png)
- **Correção sugerida:** Estruturar a barra de cabeçalho em duas linhas fixas no celular (uma para navegação de data e outra para visão) e unificar botões.

---

### 6.7 Prazos da Equipe · SLA (`/gerencia/sla`)
- **Componente Principal:** [`apps/web/components/erp/sla-monitor.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-monitor.tsx)
- **Desvios:** Tabela extensa com rolagem horizontal obrigatória no mobile ocultando a situação de atraso; repetição constante do aviso de fuso horário de Fortaleza.
- **Evidências:**
  * Desktop: ![SLA Prazos Desktop](prints/07-sla-prazos-desktop.png)
  * Mobile: ![SLA Prazos Mobile](prints/07-sla-prazos-mobile.png)
  * Modo Escuro: ![SLA Prazos Dark](prints/07-sla-prazos-dark.png)
- **Correção sugerida:** Transformar as linhas da tabela em cartões contextuais com badge de SLA em evidência quando a largura for menor que 640 px.

---

### 6.8 Escala de Plantão (`/gerencia/plantao`)
- **Componente Principal:** [`apps/web/components/erp/team-roster.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/team-roster.tsx) e [`team-roster-views.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/team-roster-views.tsx)
- **Desvios:** Botão de simulação fictícia (*"Ver exemplo"*) ativo em produção sem aviso enfático; quebra das pílulas de navegação de períodos no smartphone; múltiplos botões desordenados no topo.
- **Evidências:**
  * Desktop: ![Escala Plantão Desktop](prints/08-escala-plantao-desktop.png)
  * Mobile: ![Escala Plantão Mobile](prints/08-escala-plantao-mobile.png)
  * Modo Escuro: ![Escala Plantão Dark](prints/08-escala-plantao-dark.png)
- **Correção sugerida:** Destacar banner visual evidente ao alternar para a escala demonstrativa e consolidar ações da gerência em barra unificada.

---

### 6.9 Equipe Técnica (`/gerencia/tecnicos` e `/gerencia/tecnicos/[id]`)
- **Componente Principal:** [`apps/web/components/erp/people-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/people-pages.tsx)
- **Desvios:** Parágrafo longo de explicação técnica sobre cálculo de SLA histórico ocupando a área nobre; campo de busca excessivamente estreito (`w-36`); ações isoladas sem barra padronizada.
- **Evidências:**
  * Desktop: ![Equipe Técnicos Desktop](prints/09-equipe-tecnicos-desktop.png)
  * Mobile: ![Equipe Técnicos Mobile](prints/09-equipe-tecnicos-mobile.png)
  * Modo Escuro: ![Equipe Técnicos Dark](prints/09-equipe-tecnicos-dark.png)
- **Correção sugerida:** Mover a explicação de regra de cálculo para um tooltip ou modal explicativo e expandir o campo de busca.

---

### 6.10 Relatórios (`/gerencia/relatorios`)
- **Componente Principal:** [`apps/web/components/erp/reports-page.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-page.tsx) e [`reports-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-workspace.tsx)
- **Desvios:** Disclaimer extenso no topo ocupando espaço nobre; texto literal de variação *"change=ERP"* nos cards de KPI; abas implementadas com botões soltos em vez do componente unificado de Tabs.
- **Evidências:**
  * Desktop: ![Relatórios Desktop](prints/10-relatorios-desktop.png)
  * Mobile: ![Relatórios Mobile](prints/10-relatorios-mobile.png)
  * Modo Escuro: ![Relatórios Dark](prints/10-relatorios-dark.png)
- **Correção sugerida:** Substituir a barra manual de botões pelo componente `<Tabs variant="line">` e substituir o rótulo "ERP" por indicadores reais de base comparativa.

---

### 6.11 Relatórios de Turno (`/gerencia/relatorios-turno`)
- **Componente Principal:** [`apps/web/components/erp/shift-reports.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/shift-reports.tsx)
- **Status de Conformidade:** **Elevado.** Possui bom suporte a gravação de áudio e proteção `dirty`.
- **Desvios Menores:** Layout de reprodução de áudio e anexos fica estreito no celular de 390 px, sobrepondo o botão de download com o nome do arquivo.
- **Evidências:**
  * Desktop: ![Relatórios Turno Desktop](prints/11-relatorios-turno-desktop.png)
  * Mobile: ![Relatórios Turno Mobile](prints/11-relatorios-turno-mobile.png)
  * Modo Escuro: ![Relatórios Turno Dark](prints/11-relatorios-turno-dark.png)
- **Correção sugerida:** Permitir que o nome do anexo de áudio quebre em linha própria em telas estreitas para não espremer o botão de download.

---

### 6.12 Provedores (`/gerencia/provedores` e `/gerencia/provedores/[id]`)
- **Componente Principal:** [`apps/web/components/erp/customer-directory.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/customer-directory.tsx)
- **Desvios:** Na ficha do provedor, 4 links textuais soltos no cabeçalho; tabela de ocorrências do provedor sem paginação responsiva compacta no mobile.
- **Evidências:**
  * Desktop: ![Provedores Desktop](prints/12-provedores-desktop.png)
  * Mobile: ![Provedores Mobile](prints/12-provedores-mobile.png)
  * Modo Escuro: ![Provedores Dark](prints/12-provedores-dark.png)
- **Correção sugerida:** Agrupar links complementares ("Topologia", "Cofre", "Todas as O.S.") em um menu unificado de atalhos rápidos.

---

### 6.13 Cofre de Credenciais (`/gerencia/credenciais` e `/analista/credenciais`)
- **Componente Principal:** [`apps/web/components/erp/credentials-vault.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/credentials-vault.tsx)
- **Desvios:** Rota quebrada no menu da gerência (leva para `/analista/credenciais` e sofre bounce); microtexto `text-[10px]` em badges de categorias e total de acessos; navegação em duas colunas cria containers de scroll duplo no mobile.
- **Evidências:**
  * Desktop (Gerência): ![Cofre Gerência Desktop](prints/13-gerencia-cofre-credenciais-desktop.png)
  * Mobile (Gerência): ![Cofre Gerência Mobile](prints/13-gerencia-cofre-credenciais-mobile.png)
  * Desktop (Analista): ![Cofre Analista Desktop](prints/24-analista-cofre-desktop.png)
  * Mobile (Analista): ![Cofre Analista Mobile](prints/24-analista-cofre-mobile.png)
  * Modo Escuro: ![Cofre Dark](prints/13-cofre-credenciais-dark.png)
- **Correção sugerida:** Corrigir a rota no menu da gerência para `/gerencia/credenciais` e usar visualização de gaveta/drawer em telas de 390 px.

---

### 6.14 Ajustpedia (`/gerencia/ajustpedia` e `/analista/ajustpedia`)
- **Componente Principal:** [`apps/web/components/erp/knowledge-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/knowledge-pages.tsx)
- **Desvios:** Rota quebrada no menu da gerência; herói com estilos escuros fixos (`bg-[#0b101b]` e `text-white`) que quebram a harmonia do Modo Claro; `RecordDialog` instanciado com array vazio de campos.
- **Evidências:**
  * Desktop (Gerência): ![Ajustpedia Gerência Desktop](prints/14-gerencia-ajustpedia-desktop.png)
  * Mobile (Gerência): ![Ajustpedia Gerência Mobile](prints/14-gerencia-ajustpedia-mobile.png)
  * Desktop (Analista): ![Ajustpedia Analista Desktop](prints/25-analista-ajustpedia-desktop.png)
  * Mobile (Analista): ![Ajustpedia Analista Mobile](prints/25-analista-ajustpedia-mobile.png)
  * Modo Escuro: ![Ajustpedia Dark](prints/14-ajustpedia-dark.png)
- **Correção sugerida:** Corrigir link do menu para `/gerencia/ajustpedia` e aplicar tokens de tema flexíveis ao container superior.

---

### 6.15 Catálogo de Serviços (`/gerencia/servicos`)
- **Componente Principal:** [`apps/web/components/erp/service-types-analytics.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/service-types-analytics.tsx) e [`catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx)
- **Desvios:** Aba de relatórios abre antes do catálogo; barra de abas posicionada acima do título da página; botão de serviços padrão com descrição técnica intimidante.
- **Evidências:**
  * Desktop: ![Catálogo Desktop](prints/15-catalogo-servicos-desktop.png)
  * Mobile: ![Catálogo Mobile](prints/15-catalogo-servicos-mobile.png)
  * Modo Escuro: ![Catálogo Dark](prints/15-catalogo-servicos-dark.png)
- **Correção sugerida:** Tornar a exibição do catálogo de itens a aba inicial e posicionar a barra de navegação abaixo do título.

---

### 6.16 Políticas de SLA (`/gerencia/politicas-sla`)
- **Componente Principal:** [`apps/web/components/erp/catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx) e [`sla-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-workspace.tsx)
- **Desvios:** Alerta permanente de SLA pendente mesmo com políticas ativas; switch de ligar/desligar política atua no store local demonstrativo em vez de disparar mutação no backend.
- **Evidências:**
  * Desktop: ![Políticas SLA Desktop](prints/16-politicas-sla-desktop.png)
  * Mobile: ![Políticas SLA Mobile](prints/16-politicas-sla-mobile.png)
  * Modo Escuro: ![Políticas SLA Dark](prints/16-politicas-sla-dark.png)
- **Correção sugerida:** Conectar a alternância do Switch diretamente a uma chamada PATCH com toast de retorno e remover o alerta fixo quando houver regras.

---

### 6.17 Calendário de SLA (`/gerencia/calendario-sla`)
- **Componente Principal:** [`apps/web/components/erp/sla-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-workspace.tsx)
- **Desvios:** Ações da tabela de dias úteis com botões em formato texto puro sem ícones; tabstrip com 5 abas sem indicação de fluxo de configuração recomendado.
- **Evidências:**
  * Desktop: ![Calendário SLA Desktop](prints/17-calendario-sla-desktop.png)
  * Mobile: ![Calendário SLA Mobile](prints/17-calendario-sla-mobile.png)
  * Modo Escuro: ![Calendário SLA Dark](prints/17-calendario-sla-dark.png)
- **Correção sugerida:** Adicionar ícones aos botões de ação da tabela e unificar os parâmetros de expediente em barra de ações coesa.

---

### 6.18 Configurações (`/gerencia/configuracoes`)
- **Componente Principal:** [`apps/web/components/erp/settings-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/settings-pages.tsx)
- **Desvios:** Seção de "Administração da empresa" posicionada acima das configurações pessoais; disclaimer técnico sobre ausência de contrato backend para idioma e formato de data.
- **Evidências:**
  * Desktop: ![Configurações Desktop](prints/18-configuracoes-desktop.png)
  * Mobile: ![Configurações Mobile](prints/18-configuracoes-mobile.png)
  * Modo Escuro: ![Configurações Dark](prints/18-configuracoes-dark.png)
- **Correção sugerida:** Isolar os links de administração de empresa em uma rota própria (`/gerencia/empresa`) e remover o disclaimer técnico da aba Preferências.

---

### 6.19 Sessões e Segurança (`/gerencia/seguranca`)
- **Componente Principal:** [`apps/web/components/erp/security-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/security-workspace.tsx)
- **Desvios:** Exige digitação manual de UUID para buscar sessões de outro usuário; ausência de combobox para seleção rápida de colaboradores da equipe.
- **Evidências:**
  * Desktop: ![Segurança Desktop](prints/19-seguranca-desktop.png)
  * Mobile: ![Segurança Mobile](prints/19-seguranca-mobile.png)
  * Modo Escuro: ![Segurança Dark](prints/19-seguranca-dark.png)
- **Correção sugerida:** Trocar o campo de input de UUID por um combobox com listagem de colaboradores e avatar.

---

### 6.20 Painel e Foco do Analista (`/analista` e `/analista/foco`)
- **Componente Principal:** [`apps/web/components/erp/analyst-dashboard.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/analyst-dashboard.tsx) e [`work-focus.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/work-focus.tsx)
- **Desvios:** Duplicação entre "Meu painel" e "Foco operacional"; texto de fuso horário redundante; listagem com paginação limitada a 8 registros gerando excesso de páginas.
- **Evidências:**
  * Painel Analista Desktop: ![Área Analista Desktop](prints/20-area-analista-desktop.png)
  * Painel Analista Mobile: ![Área Analista Mobile](prints/20-area-analista-mobile.png)
  * Painel Analista Dark: ![Área Analista Dark](prints/20-area-analista-dark.png)
  * Foco Operacional Desktop: ![Foco Analista Desktop](prints/22-analista-foco-operacional-desktop.png)
  * Foco Operacional Mobile: ![Foco Analista Mobile](prints/22-analista-foco-operacional-mobile.png)
- **Correção sugerida:** Unificar o painel e o foco operacional em uma única visão integrada e aumentar o limite da página para 15 registros.

---

### 6.21 Minhas Notas (`/gerencia/notas` e `/analista/notas`)
- **Componente Principal:** [`apps/web/components/erp/notes-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/notes-workspace.tsx)
- **Status de Conformidade:** **Muito Bom.** Implementa `beforeunload`, auto-salvamento com debounce e diálogo modal confirmatório para exclusão.
- **Desvio Principal:** Acesso bloqueado para gerentes a partir do menu lateral devido ao apontamento para a rota `/analista/notas`.
- **Evidências:**
  * Desktop: ![Notas Gerência Desktop](prints/21-gerencia-minhas-notas-desktop.png)
  * Mobile: ![Notas Gerência Mobile](prints/21-gerencia-minhas-notas-mobile.png)
- **Correção sugerida:** Ajustar o link no menu da gerência em `navigation.ts` para `/gerencia/notas`.

---

## 7. Tabela Comparativa de Aderência por Página

| Rota | Componente (`components/erp/`) | Rótulos Claros | Barra Única | Proteção `dirty` | Confirmação Destrutiva | Termos Limpos | Mobile 390px |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/gerencia/workflows` *(Ref)* | [`workflow-designer.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/workflow-designer.tsx) | Sim | Sim | Sim | Sim | Sim | Sim |
| `/gerencia/ordens` | [`orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx) | Parcial | Não | Não | Sim | Parcial | Quebra |
| `/analista/ordens` | [`orders.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/orders.tsx) | Parcial | Não | Não | Sim | Parcial | Quebra |
| `/gerencia/ordens/nova` | [`attendance-intake.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/attendance-intake.tsx) | Não | Parcial | Não | N/A | Não | Sim |
| `/gerencia/ocorrencias` | [`calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx) | Sim | Não | Não | Não | Sim | Sim |
| `/gerencia/agenda` | [`calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx) | Sim | Não | N/A | Sim | Sim | Quebra |
| `/gerencia/sla` | [`sla-monitor.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-monitor.tsx) | Sim | Parcial | N/A | N/A | Parcial | Quebra |
| `/gerencia/plantao` | [`team-roster.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/team-roster.tsx) | Sim | Não | Parcial | Parcial | Parcial | Quebra |
| `/gerencia/tecnicos` | [`people-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/people-pages.tsx) | Sim | Não | N/A | Sim | Não | Sim |
| `/gerencia/relatorios` | [`reports-page.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-page.tsx) | Sim | Não | N/A | N/A | Não | Sim |
| `/gerencia/relatorios-turno`| [`shift-reports.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/shift-reports.tsx) | Sim | Sim | Sim | Sim | Sim | Parcial |
| `/gerencia/provedores` | [`customer-directory.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/customer-directory.tsx) | Sim | Não | N/A | N/A | Sim | Parcial |
| `/gerencia/credenciais` | [`credentials-vault.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/credentials-vault.tsx) | Sim | Sim | Sim | Sim | Sim | Parcial |
| `/gerencia/ajustpedia` | [`knowledge-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/knowledge-pages.tsx) | Sim | Parcial | N/A | Sim | Sim | Sim |
| `/gerencia/servicos` | [`service-types-analytics.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/service-types-analytics.tsx) | Sim | Não | N/A | Parcial | Não | Sim |
| `/gerencia/politicas-sla` | [`catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx) | Não | Não | Não | Sim | Não | Sim |
| `/gerencia/calendario-sla` | [`sla-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-workspace.tsx) | Sim | Parcial | Não | Parcial | Sim | Sim |
| `/gerencia/configuracoes` | [`settings-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/settings-pages.tsx) | Sim | Não | N/A | Sim | Não | Sim |
| `/gerencia/seguranca` | [`security-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/security-workspace.tsx) | Sim | Não | N/A | Sim | Não | Sim |
| `/analista` | [`analyst-dashboard.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/analyst-dashboard.tsx) | Sim | Parcial | N/A | N/A | Parcial | Sim |
| `/gerencia/notas` | [`notes-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/notes-workspace.tsx) | Sim | Sim | Sim | Sim | Sim | Sim |

---

## 8. Recomendações e Próximos Passos

1. **Correção Imediata de Rotas de Navegação:** Em [`apps/web/lib/navigation.ts`](file:///home/app/projects/Ajust_ERP/apps/web/lib/navigation.ts), corrigir os links do menu da gerência para evitar redirects errôneos para `/gerencia` ao tentar acessar Ajustpedia, Cofre e Notas.
2. **Pacote Universal de Formulários (`ContractForm`):** Incorporar o hook de controle de rascunho com aviso de navegação (`beforeunload`) em `contract-form.tsx` e restaurar o contraste dos rótulos removendo `text-muted-foreground` de `FieldLabel`.
3. **Consolidação em Barras Únicas de Ação:** Reorganizar as telas de Ordens, Ocorrências, Provedores e Agenda para utilizarem um único componente `<header className="panel sticky top-2 z-20 flex ...">` que agregue ações e navegação temporal.
4. **Substituição de UUIDs por Seletores Amigáveis:** Trocar o input de texto de UUID em `security-workspace.tsx` pelo combobox com busca de pessoas.
5. **Ajustes de Acessibilidade Móvel (390 px):** Aplicar containers com rolagem horizontal às barras de filtro e eliminar tamanhos de fonte inferiores a 12 px (`text-[9px]` e `text-[10px]`).


---

## 9. Atualização de Resolução (24/11/2026)

Todos os achados levantados na auditoria inicial (09/11/2026) foram endereçados nos lotes recentes e nos ajustes finais aplicados em **24/11/2026**:

### Alto Impacto — Status
- **[ALTO-01] Rotas do menu da gerência:** Resolvido em [`apps/web/lib/navigation.ts`](file:///home/app/projects/Ajust_ERP/apps/web/lib/navigation.ts) (prefixos ajustados para `/gerencia/*` no catálogo base e reescrita dinâmica em `getPortalNavigation`).
- **[ALTO-02] Proteção `beforeunload` / `dirty tracking`:** Resolvido em [`apps/web/components/erp/contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/contract-form.tsx) com monitoramento de alterações e alerta nativo antes de sair.
- **[ALTO-03] Encerramento em lote de O.S.:** Resolvido em [`apps/web/components/erp/occurrence-attendance.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/occurrence-attendance.tsx) com listagem explícita dos protocolos pendentes e caixa de confirmação obrigatória.
- **[ALTO-04] Seleção de colaborador em Sessões:** Resolvido em [`apps/web/components/erp/security-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/security-workspace.tsx) substituindo o input de UUID por seletor pesquisável de usuários.
- **[ALTO-05] Aviso de modo exemplo na Escala de Plantão:** Resolvido em [`apps/web/components/erp/team-roster.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/team-roster.tsx) com faixa fixa destacada em alerta (`border-warning bg-warning-surface`) indicando que o modo exemplo não salva alterações.

### Médio e Baixo Impacto — Status (24/11/2026)
- **[MED-02] Contraste de rótulos (`ContractFields`):** Removida a sobrescrita `font-normal text-muted-foreground` em [`contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/contract-form.tsx).
- **[MED-03] Disclaimers técnicos expostos:** Removido o texto técnico do rodapé de [`contract-form.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/contract-form.tsx) e simplificada a nota de preferências em [`settings-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/settings-pages.tsx).
- **[MED-06] Posição da barra de abas em Tipos de Serviço:** Movida para abaixo do `<PageHeading>` em [`service-types-analytics.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/service-types-analytics.tsx) e [`catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx).
- **[MED-07] Tema claro/escuro na Ajustpedia:** Aplicados tokens semânticos (`tone-surface`, `bg-card`, `border-border`) em [`knowledge-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/knowledge-pages.tsx).
- **[MED-08 / MED-11] Catálogo e Políticas de SLA:** Simplificado o texto de *"Carregar serviços padrão"*, condicionado o banner de SLA pendente à ausência de regras e conectada a persistência real do `Switch` via `PATCH` em [`catalog-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/catalog-pages.tsx).
- **[MED-09] Busca e filtro em Ocorrências:** Adicionados busca textual e filtro de status em [`calendar-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/calendar-pages.tsx).
- **[MED-10] Estilo do `<textarea>` de conclusão:** Corrigido de `native-select` para `native-input` em [`occurrence-attendance.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/occurrence-attendance.tsx).
- **[BAIX-01 / BAIX-02 / BAIX-07 / BAIX-08]:** Eliminadas todas as classes `text-[9px]` e `text-[10px]` (substituídas por `text-xs`) em `apps/web/components/erp/*.tsx`, removido o selo `"ERP"` em [`reports-page.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-page.tsx), ampliado o campo de busca em [`people-pages.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/people-pages.tsx) e adicionados ícones `Pencil`/`Trash2` em [`sla-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/sla-workspace.tsx).
