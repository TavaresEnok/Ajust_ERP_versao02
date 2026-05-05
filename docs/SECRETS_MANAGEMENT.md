# 🔐 Gerenciamento de Secrets - Ajust ERP

## ⚠️ CRÍTICO: Nunca commitar secrets reais no Git

---

## Geração de Secrets Seguros para Produção

### 1️⃣ JWT Access Secret
```bash
# Gera 64 caracteres hexadecimais (256 bits)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
echo "JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET"
```

### 2️⃣ JWT Refresh Secret
```bash
# Gera 64 caracteres hexadecimais (256 bits)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
```

### 3️⃣ Secrets Encryption Key (AES-256-GCM)
```bash
# Gera 64 caracteres hexadecimais (256 bits) para criptografia de credentials
SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "SECRETS_ENCRYPTION_KEY=$SECRETS_ENCRYPTION_KEY"
```

### 4️⃣ PostgreSQL Password
```bash
# Gera 32 caracteres hexadecimais seguros
POSTGRES_PASSWORD=$(openssl rand -hex 16)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
```

---

## ✅ Exemplo de Geração em Lote

```bash
#!/bin/bash
# gerar-secrets.sh

echo "🔐 Gerando secrets seguros para Produção..."

JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

cat << EOF
# ════════════════════════════════════════════════════════════════
#  SECRETS PRODUÇÃO - Gerado em $(date)
#  ⚠️  ARMAZENE ESTES VALORES EM VAULT/SECRETS MANAGER
#  ⚠️  NUNCA COMMITE EM GIT
# ════════════════════════════════════════════════════════════════

JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
SECRETS_ENCRYPTION_KEY=$SECRETS_ENCRYPTION_KEY
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://ajust:$POSTGRES_PASSWORD@postgres:5432/ajust_erp?schema=public&connection_limit=20

# Próximas etapas:
# 1. Copiar valores acima para seu Vault (HashiCorp, AWS Secrets Manager, etc)
# 2. Configurar GitHub Actions para injetar secrets no deploy
# 3. NUNCA armazenar em arquivo .env ou git
EOF
```

---

## 🛠️ Setup em Produção (Docker)

### Opção 1: Docker Secrets (Swarm)
```bash
# Criar secrets no Docker Swarm
docker secret create jwt_access_secret <(echo -n "seu-jwt-secret-aqui")
docker secret create jwt_refresh_secret <(echo -n "seu-jwt-secret-aqui")
docker secret create secrets_encryption_key <(echo -n "sua-encryption-key-aqui")
```

### Opção 2: Variáveis de Ambiente (Kubernetes)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ajust-secrets
type: Opaque
stringData:
  JWT_ACCESS_SECRET: "seu-jwt-secret"
  JWT_REFRESH_SECRET: "seu-jwt-secret"
  SECRETS_ENCRYPTION_KEY: "sua-encryption-key"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
      - name: api
        env:
        - name: JWT_ACCESS_SECRET
          valueFrom:
            secretKeyRef:
              name: ajust-secrets
              key: JWT_ACCESS_SECRET
```

### Opção 3: HashiCorp Vault
```bash
# 1. Armazenar secrets no Vault
vault kv put secret/ajust-prod \
  JWT_ACCESS_SECRET="seu-jwt-secret" \
  JWT_REFRESH_SECRET="seu-jwt-secret" \
  SECRETS_ENCRYPTION_KEY="sua-encryption-key"

# 2. Aplicação lê do Vault em startup
```

### Opção 4: AWS Secrets Manager
```bash
# 1. Criar secret
aws secretsmanager create-secret \
  --name ajust/prod/secrets \
  --secret-string '{
    "JWT_ACCESS_SECRET": "seu-jwt-secret",
    "JWT_REFRESH_SECRET": "seu-jwt-secret",
    "SECRETS_ENCRYPTION_KEY": "sua-encryption-key"
  }'

# 2. Container pull no startup
```

---

## 🔄 Rotação de Secrets

### Procedimento de Rotação Segura:

1. **Fase 1: Deploy com double-key**
   ```bash
   # Manter JWT_ACCESS_SECRET_OLD enquanto migra
   JWT_ACCESS_SECRET_OLD=old-secret
   JWT_ACCESS_SECRET=new-secret
   ```

2. **Fase 2: Validar tokens antigos**
   ```typescript
   // auth.service.ts
   try {
     token = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
   } catch {
     // Fallback para secret antigo
     token = jwt.verify(token, process.env.JWT_ACCESS_SECRET_OLD);
   }
   ```

3. **Fase 3: Deprecate secret antigo (24h depois)**
   ```bash
   # Remover JWT_ACCESS_SECRET_OLD após todos os tokens expirarem
   JWT_ACCESS_SECRET_OLD=null
   ```

---

## 🧪 Verificar Secrets Válidos

```bash
#!/bin/bash
# validate-secrets.sh

# Validar que secrets têm tamanho mínimo
validate_secret() {
  local secret_name=$1
  local secret_value=$2
  local min_length=$3
  
  if [ -z "$secret_value" ]; then
    echo "❌ $secret_name: NÃO DEFINIDO"
    return 1
  fi
  
  if [ ${#secret_value} -lt $min_length ]; then
    echo "❌ $secret_name: Muito curto (${#secret_value} < $min_length)"
    return 1
  fi
  
  echo "✅ $secret_name: OK (${#secret_value} chars)"
  return 0
}

# Validar todos
validate_secret "JWT_ACCESS_SECRET" "$JWT_ACCESS_SECRET" 64
validate_secret "JWT_REFRESH_SECRET" "$JWT_REFRESH_SECRET" 64
validate_secret "SECRETS_ENCRYPTION_KEY" "$SECRETS_ENCRYPTION_KEY" 64

echo "✅ Todos os secrets validados!"
```

---

## 📋 Checklist de Segurança

- [ ] Nenhum secret real em `.env` (somente dev placeholders)
- [ ] `.env` adicionado ao `.gitignore`
- [ ] Secrets armazenados em Vault/Secrets Manager
- [ ] CI/CD injeta secrets em tempo de deploy
- [ ] Rotação de secrets planejada (Q/trimestral)
- [ ] Audit log de accesso a secrets
- [ ] Backup de Vault criptografado
- [ ] DR plan para perda de Vault

---

## 🔗 Referências
- https://owasp.org/www-community/Sensitive_Data_Exposure
- https://www.vaultproject.io/
- https://aws.amazon.com/secrets-manager/
- https://kubernetes.io/docs/concepts/configuration/secret/
