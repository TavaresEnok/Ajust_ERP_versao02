# 🚀 PLANO ESTRATÉGICO: AJUST ERP 10/10
## De 3.5/10 para Líder de Mercado em 12 Meses

---

## **VISÃO FINAL**
- **Q1 2026**: Fechar vulnerabilidades críticas (7/10 → 7/10 com segurança)
- **Q2 2026**: Excelência em código + testes (7/10 → 8/10)
- **Q3 2026**: UX/Design perfeita + Mobile (8/10 → 9/10)
- **Q4 2026**: Mercado + Monetização + Diferenciação (9/10 → 10/10)

**Investimento estimado:** $250k - $400k USD (Team + Infraestrutura)  
**ROI esperado:** 3-5x em 18 meses (SaaS com $500/mês por tenant)

---

# **FASE 1: SEGURANÇA & CONFIANÇA (ABRIL-JUNHO 2026)**

## **Sprint 1.1: Fechar Críticos (2 semanas)**

### Tarefa 1.1.1: Fix Tenant Isolation
```
Objetivo: Remover 100% dos @Query('tenantId') e aceitar apenas JWT
Esforço: 40h
Responsável: 2 devs senior

Passos:
1. Audit script: grep -r "@Query.*tenantId" apps/api/src
   Resultado esperado: ~50 endpoints encontrados

2. Fix template para cada endpoint:
   ❌ ANTES:
   @Get()
   list(@Query('tenantId') tq?: string) {
     const tid = tq || req.auth.tenantId;
   }
   
   ✅ DEPOIS:
   @Get()
   list(@Req() req: RequestWithAuth) {
     if (!req.auth?.tenantId) throw UnauthorizedException();
     // Sempre usa req.auth.tenantId
   }

3. Testes de segurança:
   - GET /api/resource?tenantId=<OUTRO_TENANT> → 403
   - POST /api/resource com tenantId no body → 403
   - Listar recursos → apenas do tenant autenticado

4. Deploy: feature-flag controlado por admin
   - Rollback automático se alertas disparem
```

**Checklist de endpoint fix:**
- [ ] api-keys (4 endpoints)
- [ ] service-orders (18 endpoints)
- [ ] knowledge (12 endpoints)
- [ ] reports (8 endpoints)
- [ ] outros (8+ endpoints)

**Teste de regressão:**
```bash
# Script automatizado
npm run test:tenant-isolation
# Deve passar em 100% dos 50 endpoints
```

---

### Tarefa 1.1.2: Secrets Management
```
Objetivo: Remover secrets do código, usar Vault
Esforço: 16h
Stack: HashiCorp Vault (dev) / AWS Secrets Manager (prod)

1. Gerar secrets reais (HOJE):
   openssl rand -hex 64 > JWT_ACCESS_SECRET.txt
   openssl rand -hex 64 > JWT_REFRESH_SECRET.txt
   openssl rand -hex 32 > SECRETS_ENCRYPTION_KEY.txt

2. Setup Vault (ou AWS Secrets):
   - Dev: Docker com Vault local
   - Staging: AWS Secrets Manager
   - Prod: AWS Secrets Manager + MFA

3. Atualizar .env.example:
   [PROD] JWT_ACCESS_SECRET=<use AWS Secrets Manager>
   [PROD] DATABASE_URL=<use AWS Secrets Manager>

4. Validação em startup:
   if (NODE_ENV === 'production') {
     const secrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', ...];
     for (const key of secrets) {
       if (!process.env[key] || 
           INSECURE_DEFAULTS.has(process.env[key])) {
         throw new Error(`[CRITICAL] ${key} not configured securely`);
       }
     }
   }

5. Rotação trimestral:
   - Agenda: 1º dia de cada Q
   - Processo: AWS Secrets Manager faz tudo
   - Notificação: Slack alert
```

---

### Tarefa 1.1.3: Rate Limiting + 2FA
```
Objetivo: Proteger endpoints críticos
Esforço: 12h

1. ThrottlerModule (auth endpoints):
   npm install @nestjs/throttler redis

2. Configuração:
   /auth/login: 5 tentativas / 15 minutos
   /auth/forgot-password: 3 / 1 hora
   /auth/refresh: 10 / 1 hora
   (Usar Redis para distribuído)

3. 2FA para super_admin:
   - Gerar TOTP secret no first login
   - QR code com Google Authenticator
   - Backup codes (8 códigos de 8 dígitos)
   - Armazenar hash em BD

4. Endpoint: POST /auth/setup-2fa
   Response: { qrCode: "data:image/png...", backupCodes: [...] }

5. Verificação: POST /auth/verify-2fa
   Body: { totpCode: "123456" }
```

---

### Tarefa 1.1.4: Bootstrap Password → Email Token
```
Objetivo: Remover 4-dígito previsível
Esforço: 8h

1. Nova flow:
   Admin cria usuário → Sistema gera UUID temporário
   → Email enviado: "seu_link_de_primeiro_acesso: ..."
   → Link válido por 1 hora
   → Usuário cria sua senha própria (12+ caracteres)

2. Tabela: PasswordResetToken
   id UUID
   userId UUID (FK)
   token UUID (hash)
   expiresAt DateTime
   usedAt DateTime nullable
   createdAt DateTime

3. Código:
   POST /auth/first-login/:token
   Body: { newPassword: "SecurePass123!" }
   - Valida token (não expirado, não usado)
   - Hash password com bcrypt (cost 12)
   - Mark token como usado
   - Retorna accessToken + refreshToken

4. Email template:
   "Bem-vindo ao Ajust ERP!
    Clique aqui para acessar: 
    https://app.ajust.local/first-login/TOKEN
    Link válido por 1 hora"
```

---

## **Sprint 1.2: Observabilidade (2 semanas)**

### Tarefa 1.2.1: Sentry + Error Tracking
```
Esforço: 12h
npm install @sentry/node @sentry/profiling-node

Implementação:
1. main.ts:
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
     profilesSampleRate: 0.1,
     integrations: [
       new Sentry.Integrations.Http({ tracing: true }),
       new Sentry.Integrations.Express({ request: true, serverName: false }),
       new Sentry.Profiling.NodeProfilingIntegration()
     ]
   });

   app.use(Sentry.Handlers.requestHandler());
   app.use(Sentry.Handlers.tracingHandler());
   app.use(Sentry.Handlers.errorHandler());

2. Alertas automáticos:
   - Error rate > 1% → Slack
   - Performance: p95 latency > 500ms → Slack
   - Critical exception → PagerDuty

3. Filtros:
   - Não enviar 404s
   - Não enviar validation errors (expected)
   - Enviar tudo com NODE_ENV=production
```

---

### Tarefa 1.2.2: Prometheus + Grafana
```
Esforço: 16h
npm install @nestjs/metrics prom-client

Métricas críticas:
- http_request_duration_seconds (latência p50/p95/p99)
- http_request_total (contador por endpoint)
- db_query_duration_seconds (lentidão queries)
- cache_hit_rate (Redis effectiveness)
- tenant_count (crescimento)
- active_users_gauge (concurrent sessions)
- service_orders_total (volume negócio)

Dashboard Grafana:
- Overview: Requests/sec, errors, latency
- Database: Query times, connections, transaction volume
- Business: OS criadas/fechadas, SLA compliance
- User Activity: Login/logout, actions timeline
```

---

### Tarefa 1.2.3: Logs Estruturados (Winston/Pino)
```
Esforço: 8h
npm install pino @nestjs/pino pino-http

Estrutura de log:
{
  "timestamp": "2026-04-28T10:30:00Z",
  "level": "info",
  "service": "api",
  "traceId": "abc123",
  "userId": "user-id",
  "tenantId": "tenant-id",
  "action": "OS_CREATE",
  "osId": "os-123",
  "duration_ms": 245,
  "ip": "192.168.1.1",
  "message": "Service order created"
}

Agregação: ELK Stack (Elasticsearch + Logstash + Kibana)
ou Loki + Grafana

Retenção:
- Dev: 7 dias
- Staging: 30 dias
- Prod: 90 dias (comply LGPD)
```

---

## **Sprint 1.3: Infraestrutura Segura (2 semanas)**

### Tarefa 1.3.1: File Upload Seguro
```
Esforço: 12h

1. Validação multi-camada:
   npm install file-type sharp

   async function validateFileUpload(file: Express.Multer.File) {
     // 1. Tamanho
     if (file.size > 10 * 1024 * 1024) throw Error('Too large');
     
     // 2. Magic bytes (não extension)
     const type = await fileTypeFromBuffer(file.buffer);
     const allowed = ['image/jpeg', 'application/pdf', 'text/plain'];
     if (!allowed.includes(type?.mime)) throw Error('Invalid type');
     
     // 3. Scan antivírus (ClamAV)
     const isSafe = await scanWithClamAV(file.buffer);
     if (!isSafe) throw Error('Malware detected');
     
     // 4. Gere ID aleatório (nunca guardar nome original)
     const fileId = randomUUID();
     
     // 5. Store em path controlado
     const storagePath = join(UPLOAD_ROOT, tenantId, 'attachments', fileId);
     // Verify path is within expected dir
     if (!storagePath.startsWith(resolve(join(UPLOAD_ROOT, tenantId)))) 
       throw Error('Path traversal detected');
     
     return { fileId, path: storagePath };
   }

2. Serve com headers de segurança:
   app.get('/uploads/:fileId', (req, res) => {
     res.set('Content-Disposition', `attachment; filename="document.pdf"`);
     res.set('X-Content-Type-Options', 'nosniff');
     res.set('Content-Security-Policy', "default-src 'none'");
     res.sendFile(path);
   });

3. Storage: Object storage (não servidor)
   - Dev: LocalStack (S3 simulado)
   - Prod: AWS S3 com encryption
   - Acesso: via presigned URLs válidas por 1 hora
```

---

### Tarefa 1.3.2: CSRF + CORS + CSP
```
Esforço: 8h

1. CSRF Protection:
   npm install @nestjs/csrf-token

   app.use(new CsrfMiddleware({
     secret: process.env.CSRF_SECRET,
     cookie: 'X-CSRF-Token',
     parameterName: 'X-CSRF-Token'
   }));

   @Post()
   @CsrfProtection()
   create(@Body() body) { ... }

2. CORS (restricto):
   const allowedOrigins = [
     process.env.WEB_BASE_URL,
     ...(process.env.NODE_ENV === 'development' ? [
       'http://localhost:3000',
     ] : [])
   ];

   app.enableCors({
     origin: allowedOrigins,
     credentials: true,
     methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
     exposedHeaders: ['X-RateLimit-Remaining'],
     maxAge: 86400
   });

3. Content Security Policy:
   app.use((req, res, next) => {
     res.setHeader('Content-Security-Policy',
       "default-src 'self'; " +
       "script-src 'self' cdn.jsdelivr.net; " +
       "style-src 'self' 'unsafe-inline'; " +
       "img-src 'self' data: https:; " +
       "font-src 'self' fonts.googleapis.com; " +
       "connect-src 'self' sentry.io; " +
       "frame-ancestors 'none'; " +
       "base-uri 'self'; " +
       "form-action 'self'"
     );
     next();
   });

4. Headers de segurança:
   res.setHeader('X-Frame-Options', 'DENY');
   res.setHeader('X-Content-Type-Options', 'nosniff');
   res.setHeader('X-XSS-Protection', '1; mode=block');
   res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
   res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
```

---

# **FASE 2: EXCELÊNCIA EM CÓDIGO (JULHO-AGOSTO 2026)**

## **Sprint 2.1: Testes & Cobertura (3 semanas)**

### Objetivo: 80%+ cobertura

```
Estrutura:
  apps/api/src/
    auth/
      auth.service.spec.ts        (100%)
      auth.controller.spec.ts     (90%)
    service-orders/
      service-orders.service.spec.ts (95%)
      business-logic.spec.ts      (100%)
    integrations/
      ixc/ixc.service.spec.ts     (85%)

    __tests__/
      e2e/
        auth.e2e.spec.ts          (Full flow)
        service-orders.e2e.spec.ts
        tenant-isolation.e2e.spec.ts

Cobertura mínima:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

npm run test:coverage
Coverage report no SonarQube
```

---

### Test Suites Críticas:

**1. Auth Service (100%)**
```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should return access/refresh tokens on valid credentials');
    it('should throw on invalid password');
    it('should enforce 2FA if required');
    it('should create session record');
    it('should rate limit on 5 failed attempts');
    it('should reject bootstrap password if not first login');
  });

  describe('validateTenantIsolation', () => {
    it('should only allow access to user\'s own tenant');
    it('should reject cross-tenant access attempts');
    it('should work with multi-tenant users');
  });

  describe('refreshToken', () => {
    it('should rotate to new session');
    it('should revoke old session');
    it('should reject tokens older than 30 days');
    it('should reject revoked sessions');
  });
});
```

**2. Service Orders (95%)**
```typescript
describe('ServiceOrdersService', () => {
  describe('create', () => {
    it('should create order with SLA deadline');
    it('should apply SLA override rules');
    it('should trigger realtime notification');
    it('should create audit log');
    it('should validate required fields');
    it('should reject if user not in tenant');
  });

  describe('transitions', () => {
    it('should allow valid status transitions');
    it('should reject invalid transitions');
    it('should require approval for close if SLA exceeded');
    it('should handle concurrent transitions atomically');
  });

  describe('fileUpload', () => {
    it('should validate file magic bytes');
    it('should reject > 10MB');
    it('should reject > 10 files per order');
    it('should scan for malware');
    it('should enforce tenant isolation');
  });
});
```

---

## **Sprint 2.2: Performance & Database (2 semanas)**

### Tarefa 2.2.1: Query Optimization
```
Esforço: 16h

1. Identificar queries lentas (> 100ms):
   - Query logging com duração
   - Prometheus metrica db_query_duration_seconds
   - Grafana alert se p95 > 200ms

2. Adicionar índices faltantes:
   ```prisma
   model ServiceOrder {
     @@index([tenantId, status])
     @@index([tenantId, priority, deadlineAt])
     @@index([tenantId, externalProtocol])
     @@index([sourceSystem, externalProtocol])
     @@index([createdAt])
   }

   model AuditLog {
     @@index([tenantId, createdAt])
     @@index([actorUserId])
     @@index([action])
   }

   model User {
     @@index([email])
     @@index([status])
   }
   ```

3. N+1 Prevention com include() estratégico:
   ```typescript
   const orders = await prisma.serviceOrder.findMany({
     where: { tenantId },
     include: {
       owner: { select: { id: true, name: true, email: true } },
       assignee: { select: { id: true, name: true } },
       occurrences: { take: 5, orderBy: { createdAt: 'desc' } }
     },
     take: 20
   });
   // Verificar: Sentry/Datadog encontra queries extras
   ```

4. Connection pooling:
   - Prisma já faz, mas validar pool size
   - PgBouncer para resiliência

5. Read replicas:
   - Staging: 1 read replica
   - Prod: 2 read replicas
   - Prisma URL strategy: PRIMARY_URL + READ_URLS
```

---

### Tarefa 2.2.2: Caching Estratégico
```
Esforço: 12h

Cache com TTL:
- Tenant config: 1 hora
- User permissions: 15 minutos
- Knowledge base: 2 horas
- SLA policies: 1 dia

```typescript
// Exemplo: Cache permissions
async getUserPermissions(userId: string, tenantId: string) {
  const cacheKey = `permissions:${userId}:${tenantId}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const perms = await this.computePermissions(userId, tenantId);
  await this.redis.set(cacheKey, JSON.stringify(perms), 'EX', 900);
  return perms;
}

// Cache invalidation on role change
on(RoleAssignedEvent) {
  await this.redis.del(`permissions:${userId}:${tenantId}`);
}
```

Ferramentas:
- Redis via ioredis
- Cache-aside pattern
- Invalidação por eventos (pub/sub)
```

---

### Tarefa 2.2.3: Paginação Cursor-Based
```
Esforço: 8h

Para grandes datasets (OS, logs de auditoria):

```typescript
// ✅ Cursor pagination
@Get('service-orders')
async list(
  @Query('cursor') cursor?: string,
  @Query('limit') limit = 20
) {
  const items = await prisma.serviceOrder.findMany({
    where: {
      tenantId: req.auth.tenantId,
      // Cursor filtering
      id: cursor ? { gt: cursor } : undefined
    },
    take: limit + 1, // +1 to detect hasMore
    orderBy: { id: 'asc' }
  });

  const hasMore = items.length > limit;
  const results = items.slice(0, limit);
  
  return {
    items: results,
    nextCursor: hasMore ? results[results.length - 1].id : null,
    hasMore
  };
}
```

Benefício: O(1) em qualquer página, não O(n) como offset
```

---

## **Sprint 2.3: Code Quality (2 semanas)**

### Tarefa 2.3.1: SonarQube + Linting
```
Esforço: 8h
npm install @typescript-eslint/eslint-plugin sonarqube-scanner

1. ESLint rules:
   - No console.log
   - No hardcoded credentials
   - No TODO comments
   - Complexity < 15
   - Cyclomatic complexity < 10

2. SonarQube:
   - Code smells: 0 (detectar dívidas)
   - Bugs: 0 (detectar logical errors)
   - Vulnerabilities: 0
   - Security hotspots: Revisar todas
   - Duplication: < 3%
   - Technical debt: < 5 dias

3. Pre-commit hook:
   husky + lint-staged
   - Format com Prettier
   - Lint com ESLint
   - Type-check com TypeScript
   - Testes críticos
```

---

### Tarefa 2.3.2: Refactor: Services → Use Cases
```
Esforço: 24h

Padrão Clean Architecture:

Antes (service monolítico):
  ServiceOrdersService (1200 linhas)
    - create()
    - update()
    - list()
    - transition()
    - upload()
    - export()

Depois (use cases separados):
  CreateServiceOrderUseCase (100 linhas)
  UpdateServiceOrderUseCase (80 linhas)
  ListServiceOrdersUseCase (120 linhas)
  TransitionServiceOrderUseCase (90 linhas)
  UploadAttachmentUseCase (110 linhas)
  ExportServiceOrdersUseCase (100 linhas)

  Cada um com:
  - Input dto
  - Output dto
  - Validação
  - Business rules
  - Eventos de domínio
  - Tratamento de erros

Benefício:
- Testabilidade aumenta 3x
- Complexidade ciclomática cai
- Cada usecase é independente
```

---

# **FASE 3: UX 10/10 (SETEMBRO-OUTUBRO 2026)**

## **Sprint 3.1: Design System & Brand (2 semanas)**

### Tarefa 3.1.1: Design System Completo
```
Objetivo: Componentes reutilizáveis, tema unificado

npm install storybook @storybook/react shadcn/ui

Componentes base (com Storybook):
- Button (4 variants: primary, secondary, danger, outline)
- Input (text, email, password, number)
- Select (dropdown com search)
- Modal (com animations)
- Toast (notifications)
- Tabs
- Accordion
- Table (com sort/filter/pagination)
- Sidebar Navigation
- Avatar
- Badge
- Progress Bar
- Spinner

Guidelines:
- Color palette (5 cores base + gradients)
- Typography (2-3 font families)
- Spacing (8px grid)
- Icons (SVG sprite)
- Animations (transition times, easing)
- Accessibility (WCAG 2.1 AA)

Storybook stories:
- States: default, hover, active, disabled
- Sizes: sm, md, lg
- Responsive: mobile, tablet, desktop
```

---

### Tarefa 3.1.2: Brand & Visual Identity
```
Esforço: 40h (com designer)

1. Logo refinement
   - Variações: full, mark-only, wordmark
   - Tamanho mínimo e clearspace

2. Color palette
   - Primary: #1F41E3 (azul profissional)
   - Success: #10B981
   - Warning: #F59E0B
   - Error: #EF4444
   - Neutral: cinza 50-900

3. Typography
   - Display: Poppins 32px (headings)
   - Body: Inter 16px (main text)
   - Mono: JetBrains Mono (code)

4. Voice & tone
   - Profissional mas amigável
   - Clareza em mensagens de erro
   - Emojis ocasionais (não overdoing)

5. Photography style
   - Ilustrações custom (não stock images)
   - Screenshots com mockups
   - Dashboard visual hierarchy

Deliverables:
- Brand guidelines PDF
- Figma design system
- Color tokens (CSS variables)
```

---

## **Sprint 3.2: UX Research & Testing (2 semanas)**

### Tarefa 3.2.1: User Research
```
Esforço: 60h (mix pesquisa + design)

1. Entrevistas (12 usuários)
   - 4 super_admin (ISP owners)
   - 4 gerentes/analistas (team leads)
   - 4 técnicos (field workers)

   Perguntas:
   - Qual é o seu maior pain point?
   - Quanto tempo gasta em cada tarefa?
   - O que falta no sistema?
   - Qual é sua frequência de acesso?
   - Mobile ou desktop?

   Insights esperados:
   - Técnicos querem mobile app
   - Gerentes querem dashboards melhores
   - Admins querem automação
   - Todos querem melhor notificação

2. Surveys online (100+ respondentes)
   - SUS score (System Usability Scale) atual
   - Task completion rate
   - Feature importance ranking

3. Usability testing (5 sessions)
   - Cenário: Criar e fechar uma OS
   - Cenário: Consultar SLA pending
   - Cenário: Exportar relatório
   - Observar: Cliques, hesitações, confusão
   - Registrar: Tempo por tarefa

4. Analytics tracking (heatmaps)
   - Onde clicam mais?
   - Qual feature menos usada?
   - Funnel de conversão (cadastro → primeiro uso)
```

---

### Tarefa 3.2.2: Redesign Principal (UX/UI)
```
Esforço: 80h (com designer UX senior)

1. Dashboard (antes vs depois):
   
   ANTES: Tabela com todas as OS
   - Scrolling horizontal
   - Sem priorização visual
   - Informações redundantes
   
   DEPOIS: 
   - Cards de status (Aberta: 5, Em análise: 12, etc)
   - Kanban board visual
   - Filtros flutuantes
   - Cada card mostra: título, prioridade, SLA status
   - Timeline visual do SLA
   - Quick actions: assign, comment, close

2. Fluxo de criação OS (antes vs depois):

   ANTES: 10 campos, form linear
   
   DEPOIS:
   - Step 1: Tipo + Prioridade (visual selection)
   - Step 2: Descrição (rich text)
   - Step 3: Atribuição (busca inteligente)
   - Autosave em cada passo
   - Erro inline, não na submit

3. Mobile view (novo):
   - Bottom navigation com 4 abas
   - Cards grande em full screen
   - Swipe para transições
   - Notificações push

4. Sidebar navigation (melhorado):
   - Collapse em mobile
   - Breadcrumb visible
   - Busca global na top

5. Tables mais inteligentes:
   - Sort by click header
   - Inline filters
   - Bulk actions (checkbox)
   - Export CSV/PDF button
   - Infinite scroll OR pagination
```

---

## **Sprint 3.3: Performance Frontend (2 semanas)**

### Tarefa 3.3.1: Otimização Carregamento
```
Esforço: 20h

1. Code splitting:
   - Lazy load modules por rota
   - Suspense boundaries com skeletons

   import { lazy, Suspense } from 'react';
   
   const ServiceOrdersPage = lazy(() => 
     import('./pages/ServiceOrdersPage')
   );

   <Suspense fallback={<Skeleton />}>
     <ServiceOrdersPage />
   </Suspense>

2. Image optimization:
   - WebP + fallback JPEG
   - Responsive images (srcset)
   - Lazy loading (native loading="lazy")
   - No images > 2MB

3. Bundle size:
   - npm install bundlesize
   - Target: < 500KB (gzip)
   - Monitor cada release

4. Next.js optimizations:
   - getStaticProps para dados estáticos
   - getServerSideProps apenas quando necessário
   - ISR (Incremental Static Regeneration)
   - API routes (não chamadas externas)

5. Metrics (Core Web Vitals):
   - LCP: < 2.5s (Largest Contentful Paint)
   - FID: < 100ms (First Input Delay)
   - CLS: < 0.1 (Cumulative Layout Shift)

   npm install web-vitals
   Track em Sentry + Grafana
```

---

### Tarefa 3.3.2: State Management (Redux ou Zustand)
```
Esforço: 24h

Estado global necessário:
- Auth (user, token, permissions)
- Tenant (current tenant, config)
- Notifications (toast queue)
- Theme (dark/light)
- Filter state (OS list, reports)

Usar Zustand (mais simples que Redux):

```typescript
// store/authStore.ts
export const useAuthStore = create((set) => ({
  user: null,
  isLoading: false,
  
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      set({ user: res.data.user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },
  
  logout: () => set({ user: null })
}));

// Uso em componentes:
const { user, login } = useAuthStore();
```

Benefício:
- Evita prop drilling
- Melhor performance (subscribers)
- DevTools para debug
```

---

## **Sprint 3.4: Mobile App (4 semanas)**

### Tarefa 3.4.1: React Native MVP
```
Esforço: 160h (2 devs, 4 semanas)

Stack:
- React Native + TypeScript
- Expo (para prototipagem rápida)
- React Navigation
- AsyncStorage (local data)
- React Native Firebase (push notifications)

Funcionalidades MVP:
1. Login / Biometric
2. Dashboard (meu status)
3. Minhas OS (list + detail)
4. Criar ocorrência
5. Atualizar status
6. Comentários
7. Fotos / Anexos
8. Notificações push

Telas:
- Splash (boot animation)
- Login (email/fingerprint)
- Dashboard (statistics)
- Orders list (swipe refresh)
- Order detail (tabs: info, ocurrence, attachments)
- Map (localização de campo)
- Profile

Performance:
- Bundle size < 50MB
- Startup time < 2s
- Offline-first com sync
- Battery optimization

Store: iOS App Store + Google Play
- Beta testing (100 users)
- Feedback collection
- Rating > 4.5 stars
```

---

# **FASE 4: MONETIZAÇÃO & MERCADO (NOVEMBRO-DEZEMBRO 2026)**

## **Sprint 4.1: Pricing & Packaging (1 semana)**

### Modelos possíveis:
```
Opção 1: Per-User Per-Month (mais comum em SaaS B2B)
  Starter: $199/mês (até 5 usuários, 100 OS/mês)
  Growth: $499/mês (até 20 usuários, unlimited OS)
  Enterprise: Custom (dedicado, suporte premium)

Opção 2: Per-Tenant Fixed
  Startup: $999/mês (1 tenant pequeno)
  Professional: $2.999/mês (múltiplas integrações)
  Enterprise: $9.999/mês (SLA 99.99%, suporte 24/7)

Opção 3: Usage-Based (mais justo para crescimento)
  Base: $499/mês (incluído até 1000 OS/mês)
  Cada 1000 OS extra: +$100

Recomendação: Híbrido
  Base por usuário + volume de OS
  Exemplo: $299/mês + $0.50 por OS/mês
```

---

## **Sprint 4.2: Go-to-Market (3 semanas)**

### Tarefa 4.2.1: Product-Market Fit
```
Objetivo: Validar com 10 primeiros clientes pagantes

1. Inbound:
   - Landing page com caso de uso
   - Blog com dicas para ISPs
   - SEO otimizado (palavras-chave: "ERP para ISP", etc)
   - Email drip campaign

2. Outbound:
   - Lista de 500 ISPs Brasil
   - Personalized outreach (LinkedIn)
   - Webinars educacionais
   - Free trial: 14 dias, sem CC

3. Onboarding:
   - Setup call (30 min)
   - Training video (1 hora)
   - Email checklist
   - Slack support direto
   - NPS tracking

4. Retenção:
   - Check-in call em 30 dias
   - Usage tracking (alertar se inativo)
   - Feature roadmap transparente
   - Community forum

5. Expansion:
   - Upsell mobile app (+$49/mês)
   - Upsell analytics premium (+$99/mês)
   - Upsell integrations (+$50 cada)
```

---

### Tarefa 4.2.2: Marketing & Posicionamento
```
Esforço: 80h (com marketing hire ou agency)

Mensagem principal:
"O único ERP feito para ISPs brasileiros.
 Reduz tempo de resolução em 40%, aumenta NPS."

Canais:
1. SEO Blog
   - "Como reduzir tempo de SLA em 50%"
   - "Comparação: Zendesk vs ERP customizado"
   - "Checklist compliance LGPD para ISP"
   - Target: 1000 visitors/mês → 10 leads/mês

2. LinkedIn
   - 3-5 posts/semana (founder)
   - Thought leadership
   - Case studies de clientes
   - Job postings (build authority)

3. Community
   - Forum de ISPs (criar ou penetrar)
   - Discord community
   - Presença em eventos ISP

4. Partnerships
   - Integração com software complementar
   - Co-marketing com vendedores de ONU/equipamento
   - Affiliate program para consultores

5. Press & Awards
   - Pitch para tech press (TechCrunch Brasil)
   - Aplicar para prêmios startup
   - Entrevistas em podcasts
```

---

### Tarefa 4.2.3: Customer Success Program
```
Esforço: 40h (hiring + setup)

Contratar: 1 Customer Success Manager

Responsabilidades:
- Onboarding de novos clientes
- Treinamento de equipes
- Regular check-ins (mensal)
- Issue escalation
- Upsell/expansion opportunities
- NPS tracking

Métricas:
- NPS target: > 50
- Retention rate: > 95%
- Time-to-value: < 1 semana
- Support response: < 1 hora (críticos)
```

---

## **Sprint 4.3: Diferenciação (2 semanas)**

### Tarefa 4.3.1: Feature Competitiva
```
Implementar 1-2 features que concorrentes não têm:

Opção A: IA para SLA Prediction
  - ML model: Prever se uma OS vai atrasar
  - Input: tipo, prioridade, horário, técnico
  - Output: % risco de atraso, sugestões de ação
  - Benefício: Reduz atrasos em 30%
  
  Implementação:
  - Treinar com dados históricos
  - Use TensorFlow.js ou AWS SageMaker
  - Call em tempo real ao criar OS

Opção B: Workflow Builder (visual)
  - Drag-and-drop rules
  - "Se SLA < 2h E tipo=ROMPIMENTO, assign ao TOP técnico"
  - "Após 24h sem atualização, enviar alerta"
  - Sem necessidade de dev
  
  Benefício: Automação operacional, vira SaaS

Opção C: RPA para Terceiros
  - Automatizar envio de documentos
  - Atualizar status em sistemas legados
  - Gerar relatórios automáticos
```

---

### Tarefa 4.3.2: Integrações Premium
```
Expandir além de IXC:

1. Gestores de terceiros:
   - Atendix (técnicos)
   - Linker Sistemas
   - Custom SOAP/XML

2. ERP/CRM:
   - RD Station
   - Pipedrive
   - SAP

3. Communication:
   - Twilio (SMS/WhatsApp)
   - SendGrid (email)
   - Slack notifications

Modelo:
- Integrações básicas: Free (2)
- Integrações avançadas: +$50/mês cada

Marketplace de integrações:
- Documentação pública
- Partner API
- Revenue share (70% partner)
```

---

# **ROADMAP CONSOLIDADO**

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: SEGURANÇA        │ FASE 2: QUALIDADE    │ FASE 3: UX   │
│  (Abr-Jun 2026)           │ (Jul-Ago 2026)       │ (Set-Out)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Semana 1-2: Tenant isolation     Sem 9-10: Tests (80%)  Sem 13-14:│
│ Semana 3-4: Secrets + 2FA        Sem 11-12: Perf opt    │ Design   │
│ Semana 5-6: Observabilidade      Sem 13-14: Refactor    │ System   │
│ Semana 7-8: File upload seguro   Sem 15: SonarQube      │          │
│ Semana 9-10: Infra segura        Sem 16: Finalize       │          │
│ Semana 11: Buffer & fix                                 │ Sem 15-18:
│                                                         │ Research
│ Score: 3.5 → 7.0                Score: 7.0 → 8.5       │ Design
│ Focus: SECURITY                  Focus: CODE QUALITY    │ UX/UI
│                                                         │
│                                                         │ Sem 19-20:
│                                                         │ Mobile
│                                                         │
│ Score: 8.5 → 9.5
│ Focus: USER EXPERIENCE
│
│                        FASE 4: MARKET (Nov-Dez)
│                        ├─ Go-to-market
│                        ├─ Pricing setup
│                        ├─ First customers
│                        └─ Score: 9.5 → 10.0
│
│ TOTAL: 12 MESES → 10/10
│
└─────────────────────────────────────────────────────────────────┘
```

---

# **RECURSOS NECESSÁRIOS**

## **Team (12 meses)**

```
Core team (12 pessoas):
- 1x Tech Lead (alguém você, se possível)
- 3x Backend devs (segurança, performance, integrações)
- 2x Frontend devs (UX, mobile)
- 1x QA/Test automation
- 1x DevOps/Infrastructure
- 1x Product manager
- 1x Designer UX/UI
- 1x Customer success
- 1x Marketing
- 1x (buffer/hiring)

Custo estimado:
- Salários: $180k/ano person = $2.16M (12 pessoas, 12 meses)
- Infraestrutura: $50k
- Tools (Sentry, SonarQube, etc): $20k
- Total: ~$250k + salários
```

---

## **Tools & Services**

| Tool | Custo | Uso |
|------|-------|-----|
| AWS/GCP | $3-5k/mês | Hosting, Secrets Manager, S3 |
| Sentry | $500/mês | Error tracking |
| DataDog/New Relic | $1k/mês | APM |
| SonarQube | $300/mês | Code quality |
| Figma | $200/mês | Design |
| GitHub Enterprise | $300/mês | Private repos |
| Slack | $150/mês | Communication |
| Vercel/Netlify | $300/mês | Frontend hosting |
| **Total tools** | **$6-7k/mês** | |

---

# **SUCCESS METRICS (OKRs)**

## **Q1 2026: Security Foundation**
- [ ] 0 critical security issues (OWASP Top 10)
- [ ] 100% secrets in vault
- [ ] 100% endpoints with tenant isolation
- [ ] Rate limiting on 100% auth endpoints
- [ ] 2FA enforced for super_admin

**Key result:** Security audit score: 3.5/10 → 7/10

---

## **Q2 2026: Code Excellence**
- [ ] Test coverage: 0% → 80%
- [ ] Technical debt: Reduce 50%
- [ ] Database queries: p95 < 200ms
- [ ] SonarQube: 0 vulnerabilities + 0 blocker issues
- [ ] Benchmark vs competitors: Same or faster

**Key result:** Development velocity increases 2x

---

## **Q3 2026: User Experience**
- [ ] Design system: 100 components
- [ ] Usability testing: 10 sessions, SUS > 75
- [ ] Mobile app v1: 5k downloads, 4.5+ rating
- [ ] Analytics: Funnel: 100 visitors → 10 signups (10%)
- [ ] NPS > 50 (from pilot customers)

**Key result:** UX score: 6/10 → 9.5/10

---

## **Q4 2026: Market Traction**
- [ ] 10 paid customers
- [ ] MRR: $5k (10 × $500/mês avg)
- [ ] Churn rate: < 5%
- [ ] Customer acquisition cost: < $2k
- [ ] Lifetime value: > $20k

**Key result:** Product-market fit achieved

---

# **TIMELINE VISUAL**

```
2026
├─ Q1 (Jan-Mar): 3.5/10 → 5/10 (Security sprint)
│  └─ Tenant isolation, secrets, 2FA, rate limiting
├─ Q2 (Apr-Jun): 5/10 → 6.5/10 (Observability + Infra)
│  └─ Sentry, Prometheus, logs estruturados
├─ Q3 (Jul-Sep): 6.5/10 → 8/10 (Code quality)
│  └─ 80% tests, performance, database optimization
├─ Q4 (Oct-Dec): 8/10 → 9.5/10 (UX + Design System)
│  └─ Design system, research, mobile app
└─ Q1 2027: 9.5/10 → 10/10 (Market fit)
   └─ Go-to-market, pricing, first customers

FINAL: 10/10 ✅
```

---

# **RISK MITIGATION**

| Risk | Mitigação |
|------|-----------|
| Ataque de segurança durante Q1 | Pen testing externo, bug bounty |
| Falta de developers | Hiring ao longo do tempo, não big-bang |
| Abandono por usuários | Early feedback loops, weekly check-ins |
| Concorrência acelerar | Focar diferenciação (IA, workflows visuais) |
| Burn rate alto | Começar com 3 devs, escalar após MVP validado |
| Technical debt acumular | Dedique 20% sprint time a refactor |

---

# **PRÓXIMOS PASSOS (PRIMEIRA SEMANA)**

```
Segunda:
  [ ] Contratar tech lead (se não for você)
  [ ] Fazer roadmap alignment com stakeholders
  [ ] Setup Sentry + Datadog trial
  [ ] Criar backlog priorizado no Jira

Terça:
  [ ] Sprint planning Q1 (segurança)
  [ ] Setup GitHub branches/protection
  [ ] Definir SLA para regressions

Quarta:
  [ ] Começar tenant isolation audit
  [ ] Gerar secrets reais
  [ ] Planejar onboarding primeira hire

Quinta:
  [ ] Criar design brief (design system)
  [ ] Identificar primeiros 10 ISPs para beta
  [ ] Setup CI/CD pipeline (GitHub Actions)

Sexta:
  [ ] Review sprint 1 plan
  [ ] Communicate timeline ao board
  [ ] Celebrate! Você tem um plano 10/10
```

---

**Documento: PLANO_EXCELENCIA_10-10.md**  
**Versão: 1.0**  
**Última atualização: 28 Abril 2026**  
**Próxima revisão: Início de cada Q**
