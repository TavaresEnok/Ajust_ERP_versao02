# 📋 PRÉ-DEPLOYMENT CHECKLIST - FASE 1

**Versão:** 1.0  
**Data:** 30 de Abril de 2026  
**Objetivo:** Validar que todas as correções de segurança estão em produção pronto

---

## ✅ Security Hardening Checklist

### 🔐 Secrets Management
- [ ] JWT_ACCESS_SECRET gerado com `openssl rand -hex 32`
- [ ] JWT_REFRESH_SECRET gerado com `openssl rand -hex 32`
- [ ] SECRETS_ENCRYPTION_KEY gerado com `openssl rand -hex 32`
- [ ] POSTGRES_PASSWORD gerado com `openssl rand -hex 16`
- [ ] Todos os secrets armazenados em Vault/AWS Secrets Manager
- [ ] .env.prod NUNCA commitado no git
- [ ] Valores padrão ("dev-access-secret", etc) removidos
- [ ] GitHub Actions ou CI/CD injetando secrets no deploy
- [ ] Audit log de acesso a secrets configurado

### 🚀 Database Migrations
- [ ] `start-api.sh` removido `--accept-data-loss`
- [ ] Migration nova criada: `20260430_bootstrap_otp`
- [ ] `prisma migrate deploy` testado em staging
- [ ] Backup de produção feito antes de deploy
- [ ] Rollback plan documentado

### 📧 Email Service
- [ ] SMTP_HOST configurado (ex: smtp.sendgrid.com)
- [ ] SMTP_PORT configurado
- [ ] SMTP_USER e SMTP_PASS em Secrets Manager
- [ ] SMTP_FROM configurado com domínio válido
- [ ] Email de teste enviado com sucesso
- [ ] Templates de OTP testados

### 🔴 Rate Limiting
- [ ] Redis está online e acessível
- [ ] REDIS_URL configurado corretamente
- [ ] Rate limit endpoints testados:
  - [ ] POST /auth/login - 5 tentativas/15min
  - [ ] POST /auth/forgot-password - 3 tentativas/60min + lockout 15min
  - [ ] POST /auth/verify-2fa - 3 tentativas/15min + backoff exponencial
- [ ] Jitter funciona (responses com delays aleatórios)
- [ ] Fallback em memória desabilitado (Redis obrigatório)

### 🛡️ CSRF Protection
- [ ] CSRF middleware ativo em produção
- [ ] Cookie-parser configurado
- [ ] Todos os POST/PUT/PATCH/DELETE validam CSRF token
- [ ] GET/HEAD/OPTIONS sem validação CSRF
- [ ] Frontend enviando x-csrf-token header

### 🌍 Bootstrap OTP
- [ ] Modelo BootstrapOtp criado no DB
- [ ] Endpoints `/auth/bootstrap/*` testados
- [ ] OTP válido por 15 minutos
- [ ] Máximo 3 tentativas de validação
- [ ] OTP expirados limpados automaticamente
- [ ] Email com OTP recebido e formatado corretamente

### ☁️ Health Checks
- [ ] GET /health retorna 200 com todas dependências
- [ ] GET /health retorna 503 se DB está down
- [ ] GET /ready retorna 200 apenas quando pronto
- [ ] GET /live retorna 200 se processo está rodando
- [ ] Kubernetes readiness probe configurado → GET /ready
- [ ] Kubernetes liveness probe configurado → GET /live
- [ ] Alertas se health check falha

### 🔍 Path Security
- [ ] Função `validatePathWithinBase()` testada
- [ ] Tentativa de path traversal (../../../etc/passwd) bloqueada
- [ ] Download de arquivo válido ainda funciona
- [ ] Logs de tentativas de path traversal monitorados

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] `BootstrapOtpService` - OTP geração e validação
- [ ] `ForgotPasswordRateLimitGuard` - lockout e jitter
- [ ] `TwoFactorRateLimitGuard` - backoff exponencial
- [ ] `validatePathWithinBase()` - path traversal detection
- [ ] `CsrfMiddleware` - token validation

### Integration Tests
- [ ] Bootstrap flow: request OTP → validate OTP → login
- [ ] Rate limit: 3 tentativas → lockout → aguarda timeout
- [ ] CSRF: POST sem header → 403 Forbidden
- [ ] Health checks: com DB up, com DB down
- [ ] CSV download: arquivo válido vs path traversal

### Load Tests
- [ ] Rate limit com 100 requisições concorrentes
- [ ] Health checks sob 1000 req/s
- [ ] CSRF middleware não adiciona latência significativa

### Security Tests
- [ ] Brute force login bloqueado (rate limit)
- [ ] Bypass de 2FA impossível (rate limit + backoff)
- [ ] Enumeração de emails bloqueado (jitter + rate limit)
- [ ] Path traversal bloqueado
- [ ] CSRF token validation funciona

---

## 📝 Documentation Checklist

- [ ] [FASE1_SECURITY_IMPLEMENTATION.md](FASE1_SECURITY_IMPLEMENTATION.md) completo
- [ ] [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md) com instruções
- [ ] PRE_DEPLOYMENT_CHECKLIST.md (este arquivo)
- [ ] Runbook de incident response
- [ ] Rollback procedures documentado
- [ ] Alert rules definidas

---

## 🚨 Critical Issues Before Deploy

- [ ] Nenhum secret hardcoded em .env (staging vs prod)
- [ ] Rate limit funcionando com Redis, não memória
- [ ] SMTP testado e funcionando
- [ ] Database backup feito
- [ ] Zero breaking changes para clientes existentes
- [ ] All tests passing (100%)
- [ ] No console.log em código production
- [ ] Logging centralizado (não em arquivo)

---

## 📊 Metrics to Monitor (Primeira Semana)

```
🔍 Security Metrics
├─ Failed login attempts (deve estar bloqueado por rate limit)
├─ OTP validation success rate (>95%)
├─ Path traversal attempts (deve ser zero)
├─ CSRF token mismatches (deve ser zero)
└─ Health check failures (deve ser zero)

⚡ Performance Metrics
├─ Health check latency (<100ms)
├─ Rate limit check latency (<10ms)
├─ CSRF validation latency (<5ms)
└─ Bootstrap OTP email delivery time (<1s)

💾 Reliability Metrics
├─ Redis uptime (100%)
├─ SMTP service uptime (>99%)
├─ Database uptime (100%)
└─ API error rate (<0.1%)
```

---

## 🔄 Rollback Plan

Se algo der errado:

1. **Rate limit causando false positives:**
   - Aumentar `ATTEMPTS_LIMIT` em guards
   - Ou desabilitar temporariamente set `REDIS_URL=""`

2. **Bootstrap OTP não funciona:**
   - Rollback migration: `prisma migrate resolve --rolled-back`
   - Remover bootstrap.controller.ts

3. **CSRF causando problemas:**
   - Remover middleware temporariamente em main.ts
   - Investigar se frontend está enviando headers corretamente

4. **Health checks falsos negativos:**
   - Remover checagem de DB, manter apenas API
   - Aumentar timeout de DB query

**Tempo máximo de rollback:** 5 minutos (via CI/CD)

---

## ✋ Sign-off

| Role | Nome | Data | Assinatura |
|------|------|------|-----------|
| Development Lead | | | |
| Security Lead | | | |
| DevOps Engineer | | | |
| QA Lead | | | |
| CTO/Tech Lead | | | |

---

## 📞 On-Call Support

**Durante deploy:**
- [ ] On-call engineer disponível
- [ ] Slack #incidents aberto
- [ ] War room pronto se necessário
- [ ] Rollback plan comunicado para o time

**Após deploy:**
- [ ] Monitoring de health checks por 1 semana
- [ ] Logs inspecionados diariamente
- [ ] Feedback de usuários coletado

---

**Status:** 🟡 Pronto para Deploy em Staging  
**Próximo:** Aprovação de Security Lead para produção
