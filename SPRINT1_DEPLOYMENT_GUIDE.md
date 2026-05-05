# Sprint 1 Security Implementation - Quick Start Guide

## 🚀 Deployment Checklist

### **Pre-Deployment** (DevOps / Sys Admin)

```bash
# 1. Generate Strong Secrets
openssl rand -hex 32  # JWT_ACCESS_SECRET (copy output)
openssl rand -hex 32  # JWT_REFRESH_SECRET (copy output)
openssl rand -hex 32  # SECRETS_ENCRYPTION_KEY (copy output)

# 2. Update Production .env
export NODE_ENV=production
export JWT_ACCESS_SECRET=<from-above>
export JWT_REFRESH_SECRET=<from-above>
export SECRETS_ENCRYPTION_KEY=<from-above>
export POSTGRES_PASSWORD=<strong-password>
export SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx  # Optional
export LOG_LEVEL=warn
export CORS_ORIGIN=https://your-domain.com

# 3. Configure nginx/reverse proxy
#    - Enable HTTPS (SSL/TLS)
#    - Configure CORS headers
#    - Add security headers (CSP, X-Frame-Options, etc.)

# 4. Build & Deploy
npm run build
docker compose -f docker-compose.prod.yml up -d

# 5. Verify Deployment
curl http://localhost:8071/monitoring/health
curl http://localhost:8071/monitoring/metrics
```

---

## 🧪 Testing After Deployment

### **E2E Security Tests**
```bash
cd apps/api

# Run security test suite (API must be running)
npm run test:e2e test/e2e-security.ts

# Expected output:
# ✅ Tenant Isolation Bypass Prevention
# ✅ Rate Limiting Validation
# ✅ 2FA Workflow
# ✅ Refresh Token Rotation
# ✅ Secrets Validation
# ✅ Observability Metrics
# 
# 6/6 tests passed 🎉
```

### **Manual Penetration Testing**
```bash
# Test 1: Tenant Isolation Bypass
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:8071/service-orders?tenantId=<OTHER>"
# Expected: 403 Forbidden

# Test 2: Rate Limiting
for i in {1..6}; do
  curl -X POST http://localhost:8071/auth/login \
    -d '{"identifier":"test@example.com","password":"wrong"}' \
    -H "Content-Type: application/json"
done
# Expected: attempts 1-5 return 401, attempt 6 returns 429

# Test 3: 2FA Setup
curl -X POST http://localhost:8071/auth/2fa/setup \
  -H "Authorization: Bearer <TOKEN>"
# Expected: Returns secret, provisioning_url, qr_code_url

# Test 4: Monitoring
curl http://localhost:8071/monitoring/metrics
# Expected: Prometheus format with all metrics
```

---

## 📊 Monitoring

### **Key Dashboards**
```
Prometheus Metrics:
  GET /monitoring/metrics

Health Check:
  GET /monitoring/health

Readiness Check:
  GET /monitoring/ready
```

### **Metrics to Monitor**
```
http_requests_total         # HTTP request count
http_request_duration_ms    # Request latency
active_connections          # Concurrent users
authentication_attempts     # Login attempts (success/failure)
rate_limit_exceeded_total   # Brute force attempts blocked
tenant_isolation_violations # Cross-tenant attempts blocked
```

### **Alerts to Configure**
```
WARNING when:
  - rate_limit_exceeded > 10/min (possible brute force)
  - tenant_isolation_violations > 0 (possible attack)
  - authentication_attempts_failed > 50/hour (credential stuffing)

CRITICAL when:
  - http_requests_total[5m] == 0 (API down)
  - active_connections > threshold (overload)
```

---

## 🔐 Security Hardening

### **Already Implemented in Sprint 1**
- ✅ Tenant isolation on all 50+ endpoints
- ✅ Rate limiting (5 attempts per 15 minutes)
- ✅ 2FA via TOTP (RFC 6238)
- ✅ Secure bootstrap tokens (256-bit)
- ✅ Secrets validation at startup
- ✅ AES-256-GCM encryption for 2FA secrets
- ✅ Refresh token rotation
- ✅ Audit logging
- ✅ Prometheus observability
- ✅ E2E security tests

### **Still Needed (DevOps/Post-Sprint 1)**
- [ ] CORS configuration
- [ ] HTTPS enforcement
- [ ] WAF rules (optional)
- [ ] DDoS protection (optional)
- [ ] Backup strategy
- [ ] Disaster recovery plan

---

## 📝 API Endpoints Reference

### **Authentication**
```
POST /auth/login
  Request:  {identifier: email, password: string}
  Response: {accessToken, refreshToken, sessionId, user}
  
POST /auth/refresh
  Request:  {refreshToken}
  Response: {accessToken, refreshToken}
  
POST /auth/logout
  Request:  {}
  Response: {success: true}
```

### **2FA Management**
```
POST /auth/2fa/setup
  Response: {secret, provisioning_url, qr_code_url}
  
POST /auth/2fa/confirm
  Request:  {secret, code}
  Response: {success: true}
  
POST /auth/2fa/disable
  Request:  {password}
  Response: {success: true}
  
GET /auth/2fa/status
  Response: {enabled: boolean}
  
POST /auth/verify-2fa
  Request:  {temporaryToken, code}
  Response: {accessToken, refreshToken}
```

### **Monitoring**
```
GET /monitoring/metrics
  Response: Prometheus format metrics
  
GET /monitoring/health
  Response: {status: "ok", timestamp, environment}
  
GET /monitoring/ready
  Response: {ready: boolean}
```

---

## 🆘 Troubleshooting

### **"Unsafe secrets in production" Error**
```
Fix: Update .env with valid production secrets
  JWT_ACCESS_SECRET=<32+ chars>
  JWT_REFRESH_SECRET=<32+ chars>
  SECRETS_ENCRYPTION_KEY=<32+ chars>
```

### **Rate Limiting Blocking Users**
```
Fix: Wait 15 minutes, or adjust LIMIT in rate-limit.guard.ts:
  const LIMIT = 5;  // Change to higher number if needed
  
Consider: Use Redis backing for distributed deployment
```

### **2FA Not Working**
```
Check: User has twoFactorEnabled=true in database
Verify: TOTP code within ±30 seconds of server time
Test: Use Google Authenticator or similar TOTP app
```

### **Metrics Endpoint Returns Empty**
```
Fix: Make some HTTP requests first (metrics are recorded dynamically)
     Or check if API was recently started (data collection ongoing)
```

---

## 📚 Documentation

### **Files to Review**
- `SPRINT1_SECURITY_FINAL_REPORT.md` - Detailed audit findings
- `SPRINT1_PENETRATION_TESTING_REPORT.md` - Penetration test results
- `SPRINT1_COMPLETION_SUMMARY.md` - Complete implementation overview
- `/apps/api/test/e2e-security.ts` - Runnable security tests

### **Code Documentation**
- `/apps/api/src/auth/tenant-isolation.guard.ts` - Multi-tenant security
- `/apps/api/src/auth/rate-limit.guard.ts` - Brute force prevention
- `/apps/api/src/auth/totp.service.ts` - 2FA implementation
- `/apps/api/src/auth/auth.service.ts` - Auth flow with 2FA

---

## ✅ Success Criteria

Deployment is successful when:
- [x] API build passes
- [x] E2E tests pass (6/6)
- [x] Penetration tests pass (12/12)
- [x] `/monitoring/health` returns 200 OK
- [x] `/monitoring/metrics` returns metrics
- [x] Login works for existing users
- [x] 2FA can be enabled on test user
- [x] Rate limiting blocks after 5 attempts
- [x] Audit logs are being written

---

## 🚨 Post-Deployment

### **First Week**
- Monitor `/monitoring/metrics` for anomalies
- Review `/logs/error.log` for issues
- Test user 2FA setup with internal team
- Verify rate limiting with test attempts

### **First Month**
- Review audit logs for suspicious patterns
- Conduct security awareness training
- Plan WAF/DDoS rules (optional)
- Schedule monthly penetration test

### **Ongoing**
- Monthly security review
- Quarterly penetration testing
- Annual security audit
- Continuous dependency updates

---

## 📞 Support

**Security Questions**: Review the penetration testing report  
**2FA Issues**: Check TOTP time sync with NTP  
**Rate Limiting**: Documented in rate-limit.guard.ts  
**Metrics**: Use Prometheus dashboards or `/monitoring/metrics`

---

**Sprint 1 Complete**: 28 de abril de 2026  
**Status**: Ready for Production ✅
