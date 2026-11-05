#!/usr/bin/env bash
# Lote 0 da auditoria (C-046, C-047, C-065, C-077, C-078): aplica portas locais, Redis com senha,
# segredos novos e recriptografia das topologias. Derruba todas as sessões (todos fazem login de novo)
# e reinicia os contêineres do ERP (~1 a 2 minutos fora do ar).
#
# Pré-requisitos (preparados em 04/11/2026):
#   /home/app/backups/ajust_erp/env.novo           .env candidato com os segredos novos
#   /home/app/backups/ajust_erp/<data>/            backup do banco, uploads e chave do cofre
#
# Uso: scripts/lote0-aplicar.sh --confirm=ajust_erp
set -euo pipefail
cd "$(dirname "$0")/.."

CANDIDATO=/home/app/backups/ajust_erp/env.novo
PG=ajust_erp-postgres-1
[[ "${1:-}" == "--confirm=ajust_erp" ]] || { echo "Use: $0 --confirm=ajust_erp"; exit 1; }
[[ -f "$CANDIDATO" ]] || { echo "Falta $CANDIDATO"; exit 1; }
ls -d /home/app/backups/ajust_erp/"$(date +%Y%m%d)"_* >/dev/null 2>&1 || { echo "Sem backup de hoje em /home/app/backups/ajust_erp"; exit 1; }

valor() { grep -E "^$1=" "$2" | tail -1 | cut -d= -f2-; }
OLD_KEY=$(valor SECRETS_ENCRYPTION_KEY .env)
NEW_KEY=$(valor SECRETS_ENCRYPTION_KEY "$CANDIDATO")
NEW_PG=$(valor POSTGRES_PASSWORD "$CANDIDATO")
PG_USER=$(valor POSTGRES_USER .env); PG_USER=${PG_USER:-ajust}
PG_DB=$(valor POSTGRES_DB .env); PG_DB=${PG_DB:-ajust_erp}
OLD_DB_URL=$(valor DATABASE_URL .env)

echo "1/6 Simulação da recriptografia (não grava)"
OLD_SECRETS_ENCRYPTION_KEY="$OLD_KEY" NEW_SECRETS_ENCRYPTION_KEY="$NEW_KEY" DATABASE_URL="$OLD_DB_URL" \
  node scripts/rotate-secrets-key.cjs

# Valida as novas travas antes de interromper qualquer serviço.
DATA_SCRIPT_BACKUP_VERIFIED=1 DATABASE_URL="$OLD_DB_URL" node -e \
  'require("./scripts/data-script-guard.cjs").assertDataScriptAllowed()' -- script --apply --confirm-database="$PG_DB"

echo "2/6 Parando web, api e worker"
# Pelo nome: o compose novo só interpola com o .env novo, que ainda não foi instalado.
docker stop ajust_erp-web-1 ajust_erp-api-1 ajust_erp-worker-1 >/dev/null

echo "3/6 Recriptografando topologias com a chave nova"
DATA_SCRIPT_BACKUP_VERIFIED=1 OLD_SECRETS_ENCRYPTION_KEY="$OLD_KEY" NEW_SECRETS_ENCRYPTION_KEY="$NEW_KEY" DATABASE_URL="$OLD_DB_URL" \
  node scripts/rotate-secrets-key.cjs --apply --confirm-database="$PG_DB"

echo "4/6 Revogando todas as sessões e trocando a senha do Postgres"
docker exec "$PG" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" -q \
  -c "UPDATE \"Session\" SET \"revokedAt\" = now() WHERE \"revokedAt\" IS NULL;"
docker exec -i "$PG" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" -q -v pw="$NEW_PG" \
  <<<"ALTER USER \"$PG_USER\" WITH PASSWORD :'pw';"

echo "5/6 Instalando o .env novo e recriando os contêineres (pgAdmin é removido)"
install -m 600 "$CANDIDATO" .env
docker compose up -d --remove-orphans

echo "6/6 Conferências"
for i in $(seq 1 60); do
  docker compose ps --format '{{.Service}} {{.Health}}' | grep -qE '^(api|worker|web) (starting|unhealthy)' || break
  sleep 5
done
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
docker exec ajust_erp-redis-1 redis-cli ping 2>&1 | grep -q NOAUTH && echo "Redis exige senha: ok"
ss -ltn | grep -E ':(8072|8073|8076|8077|8092|3100)\b' || true
echo "Pronto. Todos precisam entrar de novo. Backup do .env anterior está na pasta de backup de hoje."
