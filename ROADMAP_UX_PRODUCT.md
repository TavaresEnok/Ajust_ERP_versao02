# 🎨 ROADMAP DE UX & PRODUCT: De Bom para Excelente

## Ajust ERP: Jornada UX (6/10 → 9.5/10)

---

## **ANÁLISE COMPETITIVA**

### **Benchmarks: Zendesk vs OTRS vs Ajust**

```
DIMENSÃO                 Zendesk    OTRS      Ajust      META
════════════════════════════════════════════════════════════
Facilidade uso (SUS)     78/100     65/100    ~60/100    75/100
Mobile app quality       ⭐⭐⭐⭐   ⭐⭐     ❌        ⭐⭐⭐⭐
Customização visual      ⭐⭐⭐     ⭐⭐⭐⭐   ⭐⭐      ⭐⭐⭐⭐
Dashboard inteligência   ⭐⭐⭐⭐   ⭐⭐     ⭐⭐      ⭐⭐⭐⭐
Performance (load)       < 100ms    200-400ms 150-300ms  < 100ms
Suporte técnico          24/7 chat  Email     Email      24/7 chat
Integrations             150+       20+       2          50+
On-premise option        ❌         ✅        ✅         ✅
Brasil localization      Parcial    Não       ✅         ✅
Pricing                  $49/agente $3k/yr   $499/tenant $299/user
Market share (Brasil)    ~15%       ~5%       0%         Target 5%

VANTAGEM COMPETITIVA: Zendesk (conveniência), OTRS (preço), 
                      Ajust (localização + ISP specialization)
```

---

## **PERSONAS & JOBS TO BE DONE**

### **Persona 1: Marcos (Dono ISP)**
```
Idade: 45 anos
Renda: R$ 50k-100k/mês
Pain points:
  - Não consegue ver overview real da operação
  - Precisa de relatórios em 5 minutos, não em 1 hora
  - Quer saber: quantas OS abertas? SLA breached? Técnico desapareceu?

Jobs to be done:
  1. "Preciso ver se meu SLA tá sendo cumprido, AGORA"
     Solution: Dashboard em 1 clique, status cards coloridos
  
  2. "Tenho que chamar gerente, mas não tenho seus dados"
     Solution: Busca global ultra-rápida, sugestões

  3. "Preciso explicar situação pra cliente insatisfeito"
     Solution: PDF report em 1 clique

Métrica de sucesso: 
  - Consegue responder qualquer pergunta em < 2 min
  - NPS: 8-10
```

---

### **Persona 2: João (Gerente Técnico)**
```
Idade: 35 anos
Renda: R$ 15k-20k/mês
Pain points:
  - 50 técnicos espalhados, nunca sabe aonde estão
  - Atribuir ordem pra pessoa certa leva 10 minutos
  - App mobile não existe (usa browser no celular)
  - Relatórios de performance do técnico muito fracos

Jobs to be done:
  1. "Quem é o melhor técnico pra essa ordem?"
     Solution: Smart assignment (baseado em skills, localização, carga)
  
  2. "Meu técnico não marca presente, preciso saber aonde ele ta"
     Solution: Map view + real-time location
  
  3. "Preciso de comproação que fizemos o trabalho"
     Solution: Photo + time tracking integrado
  
  4. "Quanto tempo cada técnico gasta em cada tipo de chamado?"
     Solution: Analytics por técnico, trend analysis

Métrica de sucesso:
  - Assignment time: 10 min → 1 min (-90%)
  - Técnico satisfaction: 7/10 (app finally works)
  - NPS: 7-8
```

---

### **Persona 3: Ana (Técnico de Campo)**
```
Idade: 28 anos
Renda: R$ 4k-6k/mês
Pain points:
  - Só acessa sistema via notebook (não mobile)
  - Perde chamados porque não tem notificação
  - Browser fica lento, nunca sabe se caiu
  - Foto de serviço feita, mas como prove pra gerente?

Jobs to be done:
  1. "Chegou uma nova ordem? Avisa rápido"
     Solution: Push notification + alert sound
  
  2. "Preciso anotar o que fiz sem perder conexão"
     Solution: Offline mode, sync automático
  
  3. "Tirei foto, preciso guardar junto com a ordem"
     Solution: Galeria integrada, upload automático (quando WiFi)
  
  4. "Quanto tempo levei nesse chamado? Pra receber bônus"
     Solution: Cronômetro integrado, relatório time-tracking

Métrica de sucesso:
  - App adoption: 100% (se mobile existisse)
  - Técnico happiness: 8/10
  - Task accuracy: 95%
  - NPS: 8-9
```

---

### **Persona 4: Patricia (Analista RH/Compliance)**
```
Idade: 42 anos
Risco: Compliance, LGPD, relatórios

Pain points:
  - Precisa exportar dados de técnico pra auditoria
  - Sem auditoria clara de quem fez o quê
  - Relatórios demoram demais pra montar
  - LGPD: dados de clientes precisam ser protegidos

Jobs to be done:
  1. "Preciso de relatório de acesso [usuário] no mês"
     Solution: Audit log detalhado por data/hora/ação
  
  2. "Quem alterou essa ordem? Quando? Por quê?"
     Solution: Change history com detalhes
  
  3. "Preciso exportar 10k registros pra BI externo"
     Solution: Bulk export, agendado, com confirmação LGPD
  
  4. "Preciso garantir LGPD compliance"
     Solution: Data residency, encryption, right to forget

Métrica de sucesso:
  - Audit proof: 100% (compliance pass)
  - Export time: < 5 min
  - Confidence: 9/10
```

---

## **CUSTOMER JOURNEY MAP**

### **Semana 1: Onboarding**
```
Stage        Pain Point                Solution
─────────────────────────────────────────────────────────────────
Day 1        Confuso com interface     Tutorial interativo (2 min)
             Não sabe criar OS         Guided tour com video
             
Day 2        Teste de atribuição       Template pré-preenchido
             Precisa importar dados    Bulk import wizard
             
Day 3        Precisa dar treinamento   Video + doc + suporte
             Técnicos reclamam         App mobile (push para baixar)
             
End of Week  Não tem dados históricos  Importação de dados antigos
             Quer ver tudo            Dashboard overview

NPS Day 7: Target 7/10
```

---

### **Mês 1-3: Getting Value**
```
Milestone                    Value unlock
─────────────────────────────────────────────────────────────────
Primeira OS criada           "Sistema funciona!"
Atribuição automática        "Poupa 30 min/dia!"
Relatório primeiro           "Finalmente tenho dados"
Técnico usando mobile        "Posso trabalhar em qualquer lugar"
SLA tracking visível         "Agora controlo o SLA"
Dashboard crítico            "Gerente vê tudo em 1 clique"

NPS Month 1-3: Target 8/10 (Net Promoter Score)
```

---

## **FEATURE PRIORITY MATRIX (Impact vs Effort)**

```
              LOW EFFORT              HIGH EFFORT
            ┌─────────────┬─────────────────────┐
            │ Dark Mode   │ Mobile App          │
HIGH IMPACT │ (1 dev/2d)  │ (2 devs/4 weeks)    │
            │ ✅ Quick Win│ ⭐ Strategic        │
            ├─────────────┼─────────────────────┤
            │ Perfume     │ Advanced Analytics  │
LOW IMPACT  │ (polish)    │ AI Recommendations │
            │ ❌ Later    │ 🔴 Not now          │
            └─────────────┴─────────────────────┘

QUADRANTE 1 (Quick Wins - Fazer AGORA):
□ Dark mode theme (2d)
□ Export to Excel (3d)
□ Email notifications (2d)
□ Search global (3d)
□ Responsive tables (4d)

QUADRANTE 2 (Strategic - Roadmap):
□ Mobile app (4 weeks)
□ Realtime notifications (2 weeks)
□ BI dashboards (3 weeks)
□ Workflow builder (4 weeks)

QUADRANTE 3 (Time wasters - Ignore):
□ Customizable colors
□ Custom fonts
□ Lottie animations (fancy)

QUADRANTE 4 (Maybe later):
□ Advanced ML
□ Voice commands
```

---

## **DESIGN SYSTEM COMPONENTS (Phased Rollout)**

### **Phase 1: Foundation (Semanas 1-2)**
```
Components:
  ✅ Button (primary, secondary, danger, loading)
  ✅ Input (text, password, email, number, search)
  ✅ Typography (H1-H6, body, small)
  ✅ Colors (primary, success, warning, error, neutral)
  ✅ Spacing tokens (4, 8, 12, 16, 20, 24...)
  ✅ Icons (Heroicons set)

Storybook stories: ~20
Figma coverage: 30%
```

### **Phase 2: Common Patterns (Semanas 3-4)**
```
Components:
  ✅ Select / Dropdown
  ✅ Modal / Dialog
  ✅ Toast / Notification
  ✅ Tabs
  ✅ Badges
  ✅ Avatar
  ✅ Breadcrumb
  ✅ Pagination

Stories: +30 (total 50)
Figma: 50%
```

### **Phase 3: Complex Components (Semanas 5-6)**
```
Components:
  ✅ Table (sorting, filtering, bulk actions)
  ✅ Form (validation, error states)
  ✅ Stepper / Wizard
  ✅ Accordion
  ✅ Date picker
  ✅ File uploader
  ✅ Chart components (basic)

Stories: +50 (total 100)
Figma: 75%
```

### **Phase 4: Application Layouts (Semanas 7-8)**
```
Patterns:
  ✅ Dashboard grid
  ✅ List view (cards vs table)
  ✅ Detail view (single item)
  ✅ Form layouts (centered, sidebar, modal)
  ✅ Navigation patterns (sidebar, top nav)
  ✅ Empty states
  ✅ Error boundaries
  ✅ Loading states

Stories: +50 (total 150)
Figma: 100%
Storybook: Fully documented + Accessibility
```

---

## **MOBILE APP STRATEGY**

### **Why Native (React Native) vs Web App?**

```
Criteria                React Native      Web App (PWA)
─────────────────────────────────────────────────────
Push notifications      ⭐⭐⭐⭐ Native    ⭐⭐ Web push (limited)
Offline functionality   ⭐⭐⭐⭐ SQLite     ⭐⭐⭐ Service worker
Camera integration      ⭐⭐⭐⭐ Native    ⭐⭐ Browser (limited)
GPS/Location           ⭐⭐⭐⭐ Native    ⭐⭐⭐ Native
Performance            ⭐⭐⭐ Better UX  ⭐⭐ Battery drain
App store presence     ⭐⭐⭐⭐ Yes       ❌ Browser only
User retention         ⭐⭐⭐⭐ Higher   ⭐⭐⭐ Good
Development cost       ⭐⭐⭐ Higher     ⭐⭐⭐⭐ Lower
Time to market         ⭐⭐ Slower      ⭐⭐⭐⭐ Faster

RECOMENDAÇÃO: Iniciar com Expo (rapid prototyping),
              validar, depois migrar para native (RN)
```

---

### **Mobile App Roadmap**

#### **V1 (MVP - 4 semanas)**
```
Funcionalidades:
  1. Auth: Login + Biometric
  2. Dashboard: Cards de status (Abertas, Meu carga, SLA alert)
  3. OS list: Minhas ordens, com search + filter
  4. OS detail: Info + ocorrências + anexos
  5. Update status: Dropd com razão
  6. Comentários: Add comment + view thread
  7. Notificações: Push quando nova ordem chega
  8. Offline: Última ordem acessível sem internet

Telas:
  - Splash
  - Login
  - 2FA
  - Dashboard
  - Orders list
  - Order detail
  - Comments
  - Profile
  - Settings

Performance target:
  - Bundle: < 50MB
  - Startup: < 2s
  - Offline: Works 100%

Store submission: Google Play + App Store
Beta: 100 internal users
```

#### **V2 (Enhance - Semanas 5-8)**
```
Funcionalidades:
  + Maps: Localização de clientes
  + Time tracking: Cronômetro de chamado
  + Photo upload: Camera integrada
  + Offline sync: Suporta 10+ ações offline
  + Biometric: Fingerprint login
  + Widgets: Home screen shortcuts

Target: 1k downloads, 4.0+ rating
```

#### **V3 (Scale - Semanas 9+)**
```
Funcionalidades:
  + Voice notes: Anotar chamado por voz
  + QR code: Identificar cliente/equipamento
  + Signature capture: Assinatura do cliente
  + Realtime chat: Com gerente/outros técnicos
  + Advanced map: Rota, ETA, traffic
  + Offline forms: Checklist, inspection forms

Target: 5k downloads, 4.5+ rating
```

---

## **USABILITY TESTING PLAN**

### **Round 1: Current State (Semanas 1-2)**

```
Objetivo: Identificar pain points atuais

Participantes: 5 usuários (2 gerentes, 2 técnicos, 1 analista)
Duração: 1 hora cada

Cenários:
1. "Crie uma ordem de serviço do zero"
   Métrica: Tempo, cliques, confusão
   
2. "Encontre uma ordem específica criada há 3 meses"
   Métrica: Search strategy, time
   
3. "Atualize status para 'Resolvida' e adicione nota"
   Métrica: Clareza da interface
   
4. "Exporte as últimas 100 ordens para Excel"
   Métrica: Feature descoberta, funcionamento

Outputs esperados:
- Video recording (com permissão)
- Anotações de observação
- Task completion rate
- Time on task
- Confusion points identificados
```

---

### **Round 2: Redesign Validation (Semanas 7-8)**

```
Objetivo: Validar novo design

Participantes: 10 usuários (4 gerentes, 4 técnicos, 2 analistas)
Duração: 1 hora cada

Mesmos cenários + feedback sobre visual

Métricas:
- SUS score (System Usability Scale)
- Task success rate: 95%+ target
- Time on task: Redução de 30%+
- NPS: 7+

Nova baseline será usada pra futuras comparações
```

---

## **ONBOARDING FLOW REDESIGN**

### **Antes (Atual)**
```
Step 1: Cadastro básico (5 campos)
Step 2: Integração IXC (confuso)
Step 3: Criação primeira OS (vazio, sem sugestões)
Step 4: Nada. Boa sorte!

Result: 30% abandon taxa
       50% confusão na primeira OS
```

### **Depois (Novo)**
```
Step 1: Welcome video (30s)
        "Bem-vindo! Vamos em 5 minutos?"

Step 2: Cadastro (auto-fill de emails)
        Validação real-time

Step 3: IXC Integration (assistant guiado)
        "Qual sua versão IXC?"
        → Link de docs específico
        → Testador de conexão
        → "Conectado! ✅"

Step 4: Sua primeira OS (template pré-preenchido)
        "Cliente: Marisa Coelho"
        "Tipo: ROMPIMENTO"
        "Prioridade: ALTA"
        Just fill "Descrição" + "Create"

Step 5: Success! 🎉
        "Ordem criada!"
        Next: "Atribuir técnico?" ou "Ver dashboard?"

Step 6: Mobile app CTA
        "Baixar app para notificações?"

Result: 80%+ completion
        NPS 7+ immediately
        Time to value: 10 min
```

---

## **DASHBOARD REDESIGN SPEC**

### **Antes**
```
Topo: Empresa info
Meio: Tabela gigante com todas as OS
Lado: Espaço em branco
Resultado: Scroll infinito, confuso
```

### **Depois**

#### **Mobile view (priority)**
```
┌──────────────────────┐
│ 👤 Olá, Gerente João │
├──────────────────────┤
│                      │
│  5                   │
│  ⭕ ABERTA           │
│  ⏱ 4 horas SLA      │
│                      │
├──────────────────────┤
│  12                  │
│  ⏳ EM ANÁLISE       │
│  ⏱ < 1 hora         │
│                      │
├──────────────────────┤
│  CRÍTICO!            │
│  🔴 SLA BREACH       │
│  2 orders            │
│  ⚡ Precisa ação    │
│                      │
├──────────────────────┤
│  Ver tudo →          │
├──────────────────────┤
│ 🏠 📋 ⚙️ 👤 ↓ Bottom nav
└──────────────────────┘
```

#### **Desktop view**
```
┌─────────────────────────────────────────────────────────────┐
│ Ajust ERP                          👤 João | Sair |  ⚙️   │
├──────────────────────────┬──────────────────────────────────┤
│ ▶ Menu                   │ Bem-vindo de volta, João!         │
│  • Dashboard    ← Active │                                  │
│  • Ordens                │                                  │
│  • Clientes              │ ┌─────────────┬─────────────┐   │
│  • Relatórios            │ │ Abertas    │ Em Análise  │   │
│  • Admin                 │ │     5      │     12      │   │
│                          │ └─────────────┴─────────────┘   │
│  • Configurações         │                                  │
│                          │ ┌───────────────────────────┐   │
│ Help & Support ↓        │ │ ⚠️  SLA BREACH (2)        │   │
│                          │ │ • OS #445 (2h late)      │   │
│                          │ │ • OS #521 (1h late)      │   │
│                          │ └───────────────────────────┘   │
│                          │                                  │
│                          │ Recent Activity:                 │
│                          │ • João atrib. OS #548 →        │
│                          │ • Marisa comentou em #545       │
│                          │ • OS #540 marcada Resolvida    │
│                          │                                  │
│                          │ [Ver todas]                      │
└──────────────────────────┴──────────────────────────────────┘

Kanban board option (em abas):
┌─────────────┬──────────┬──────────┬──────────┬──────────┐
│  ABERTA (5) │ ANÁLISE  │ AG. CAMPO│ AG. TERC │ FECHADA  │
│             │  (12)    │   (3)    │   (2)    │  (48)    │
├─────────────┼──────────┼──────────┼──────────┼──────────┤
│ [OS 1]      │ [OS 6]   │ [OS 9]   │ [OS 12]  │ [...]    │
│ [OS 2]      │ [OS 7]   │ [OS 10]  │ [OS 13]  │          │
│ [OS 3]      │ [OS 8]   │ [OS 11]  │          │          │
│ [...]       │ [...]    │          │          │          │
└─────────────┴──────────┴──────────┴──────────┴──────────┘

Cada card:
┌──────────────────┐
│ #548             │
│ 🔴 ROMPIMENTO   │
│ Cliente: LTDA   │
│ SLA: 3h 45m ⏱  │
│ João →          │
└──────────────────┘
```

---

## **ACCESSIBILITY CHECKLIST (WCAG 2.1 AA)**

```
Visual Design:
  □ Color contrast ≥ 4.5:1 (normal text)
  □ Color contrast ≥ 3:1 (large text)
  □ Não depender APENAS de cor (use icons/text)
  □ Focus indicator visible (outline)
  □ Zoom até 200% sem quebra

Interactive:
  □ Todos botões com label (aria-label se icon-only)
  □ Forms: <label> linked ao <input>
  □ Erro: mensagem clara + sugestão
  □ Requerido: marcado com * e aria-required

Navigation:
  □ Teclado: Tab through todos elements
  □ Não trap focus em popup (ESC fecha)
  □ Skip links: "Skip to content"
  □ Breadcrumb atual destacado

Media:
  □ Video: subtítulos + transcripts
  □ Audio: transcript
  □ Imagens: alt text significativo

Código:
  □ HTML semântico (nav, main, footer, section)
  □ ARIA only quando necessário
  □ Test com axe DevTools
  □ Test com keyboard + screen reader

Mobile:
  □ Touch targets: ≥ 48x48px
  □ Zoom funciona
  □ Orientation lock não forçado
```

---

## **FEEDBACK LOOPS**

### **In-app feedback widget**
```
Botão flutuante na canto (bottom-right):
"Feedback?"

Click → Modal:
────────────────────────────────────────
What's your feedback?
[Adorei]  [Melhorar]  [Bug]

If "Melhorar":
  "Qual feature?"
  [Select from list]

Message:
[Text area]

Email: [auto-filled] [can change]

[Enviar]

Result: → Slack notification
        → Isso vira issue no backlog
```

---

### **NPS Survey (Monthly)**
```
"De 0-10, quanto você recomendaria Ajust?"

If 0-6: "Qual o maior problema?"
        → Torna-se feedback prioritário

If 7-8: "O que poderíamos melhorar?"
        → Roadmap features

If 9-10: "Pode virar referência nossa?"
         → Case study offer

Respondentes: Random 20% de active users
Frequência: 1x/mês
Meta: NPS > 50 até final Q1 2027
```

---

## **QUICK WIN FEATURES (Implementar em Paralelo)**

| Feature | Tempo | Impacto | Owner |
|---------|-------|--------|-------|
| Dark mode | 3 dias | 🟢 Alto (dev love) | FE Dev 1 |
| Export Excel | 2 dias | 🟢 Alto | BE Dev 1 |
| Email alerts | 2 dias | 🟢 Alto | BE Dev 2 |
| Global search | 3 dias | 🟢 Alto | FE Dev 2 |
| Responsive fix | 3 dias | 🟢 Alto | FE Dev 1 |
| Keyboard shortcuts | 2 dias | 🟡 Médio | FE Dev 2 |
| Duplicate order | 1 dia | 🟡 Médio | BE Dev 1 |
| Bulk status update | 2 dias | 🟡 Médio | BE Dev 2 |
| Print OS | 1 dia | 🟡 Médio | FE Dev 1 |
| Auto-refresh dashboard | 1 dia | 🟢 Alto | FE Dev 2 |

**Total: 20 dias de dev tempo**  
**Impacto: +2.5 pontos na UX score**

---

## **CONTENT STRATEGY**

### **In-app Help (Help Center integrado)**
```
Contexto-aware:
  Usuario na tela de criar OS?
  → Botão "?" abre contexto de ajuda

Help topics:
  - What is a Service Order?
  - How to create, edit, close
  - SLA explained
  - Best practices
  - FAQs
  - Video tutorials (2-3 min cada)

Knowledge base tags:
  #SLA #Técnicos #Gestão #Integração #Billing
```

### **Emails educacionais (Post-signup)**
```
Day 1: Welcome + Quick Start video
Day 3: "Dica: Use keyboard shortcuts"
Day 7: "Os 3 erros mais comuns"
Week 2: "Como usar relatórios"
Month 1: "Primeiras automações"
Month 3: "Upgrade for mobile app"
```

### **Blog de marketing**
```
SEO targets (Brasil ISP):
  "Como aumentar SLA score 40%"
  "Reduzir tempo técnico em 50%"
  "ERP para ISP: Zendesk vs custom"
  "LGPD compliance checklist"
  "Dicas de onboarding técnico"

Frequency: 2x/semana
Format: 1500-2000 palavras
CTA: "Quer testar Ajust?"
```

---

## **POST-LAUNCH ITERATION PLAN**

```
Month 1-2: Fix bugs, quick wins
  Focus: Estabilidade, não features novas
  Métrica: Zero regressions

Month 3-4: First customer feedback
  Focus: Integrar feedback 20% mais importantes
  Métrica: NPS > 60 (primeira coorte)

Month 5-6: Design improvements
  Focus: Redesign baseado em heatmaps + feedback
  Métrica: SUS score > 75

Month 7+: Advanced features
  Focus: Mobile, IA, integrations
  Métrica: Customer expansion revenue
```

---

**Documento: ROADMAP_UX_PRODUCT.md**  
**Próxima revisão: Mensal (com data confirmada)**  
**Owner: Product Manager + UX Lead**
