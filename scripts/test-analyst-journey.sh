#!/usr/bin/env bash
# Entirely disposable database/Redis and loopback servers; never uses the project's .env.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
JOURNEY_PROJECT=${JOURNEY_PROJECT:-analista}
case "$JOURNEY_PROJECT" in
  analista) JOURNEY_LABEL=analyst ;;
  gestao) JOURNEY_LABEL=manager ;;
  *) echo 'Unsupported journey project' >&2; exit 1 ;;
esac
RUN_DIR=$(mktemp -d "/tmp/ajust-$JOURNEY_LABEL-journey.XXXXXX")
PG_CONTAINER="ajust_analyst_pg_$$"
REDIS_CONTAINER="ajust_analyst_redis_$$"
API_PID=''
WEB_PID=''
cleanup() {
  [[ -z "$WEB_PID" ]] || kill "$WEB_PID" 2>/dev/null || true
  [[ -z "$API_PID" ]] || kill "$API_PID" 2>/dev/null || true
  docker rm -f "$PG_CONTAINER" "$REDIS_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT
echo "Evidence directory: $RUN_DIR"
port() { node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
docker run -d --name "$PG_CONTAINER" -e POSTGRES_PASSWORD=ci_test_only -e POSTGRES_DB=ajust_ci -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
docker run -d --name "$REDIS_CONTAINER" -p 127.0.0.1::6379 redis:7-alpine >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$PG_CONTAINER" pg_isready -U postgres -d ajust_ci >/dev/null 2>&1; then break; fi
  sleep 1
done
DB_TEST_PORT=$(docker port "$PG_CONTAINER" 5432/tcp | sed 's/.*://')
REDIS_TEST_PORT=$(docker port "$REDIS_CONTAINER" 6379/tcp | sed 's/.*://')
export DATABASE_URL="postgresql://postgres:ci_test_only@127.0.0.1:$DB_TEST_PORT/ajust_ci?schema=public"
export REDIS_URL="redis://127.0.0.1:$REDIS_TEST_PORT"
export NODE_ENV=test
export JWT_ACCESS_SECRET=analyst_check_access_secret_minimum_32_characters
export JWT_REFRESH_SECRET=analyst_check_refresh_secret_minimum_32_characters
export JWT_RESET_SECRET=analyst_check_reset_secret_minimum_32_characters
export SECRETS_ENCRYPTION_KEY=analyst_check_encryption_secret_minimum_32_characters
export MONITORING_WEBHOOK_TOKEN=analyst_check_monitoring_secret_minimum_32_characters
export CHAT_WEBHOOK_TOKEN=analyst_check_chat_secret_minimum_32_characters
export WORKER_API_TOKEN=analyst_check_worker_secret_minimum_32_characters
export POSTGRES_PASSWORD=ci_test_only
export REQUIRE_2FA_ROLES=super_admin
export SMTP_HOST='' SMTP_USER='' SMTP_PASS=''
export SEED_E2E_PASSWORD=CiOnlyPassword@123 E2E_ROLE_PASSWORD=CiOnlyPassword@123
export E2E_ANALYST_JOURNEY=1 WORKFLOW_EXECUTION_ENABLED=true
if [[ "$JOURNEY_PROJECT" == gestao ]]; then export E2E_MANAGER_JOURNEY=1; fi
export UPLOAD_ROOT="$RUN_DIR/uploads"
TEST_API_PORT=$(port)
TEST_WEB_PORT=$(port)
export WEB_BASE_URL="http://127.0.0.1:$TEST_WEB_PORT"
export API_BASE_URL="http://127.0.0.1:$TEST_API_PORT" API_INTERNAL_URL="http://127.0.0.1:$TEST_API_PORT"
export PLAYWRIGHT_BASE_URL="$WEB_BASE_URL"
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma > "$RUN_DIR/migrations.log" 2>&1
node scripts/seed-test-db.cjs
corepack pnpm --filter @ajust/api build > "$RUN_DIR/api-build.log" 2>&1
(cd apps/api; PORT="$TEST_API_PORT" exec node dist/main.js) > "$RUN_DIR/api.log" 2>&1 & API_PID=$!
for _ in $(seq 1 45); do
  if curl -fsS --max-time 5 "$API_BASE_URL/monitoring/ready" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS --max-time 5 "$API_BASE_URL/monitoring/ready"
NODE_ENV=production corepack pnpm --filter @ajust/web build > "$RUN_DIR/web-build.log" 2>&1
(cd apps/web; NODE_ENV=production COOKIE_INSECURE=true exec node node_modules/next/dist/bin/next start -p "$TEST_WEB_PORT" -H 127.0.0.1) > "$RUN_DIR/web.log" 2>&1 & WEB_PID=$!
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "$WEB_BASE_URL/login" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS --max-time 5 "$WEB_BASE_URL/login" >/dev/null
corepack pnpm --filter @ajust/web exec playwright test --project="$JOURNEY_PROJECT" --output="$RUN_DIR/browser" "$@"
