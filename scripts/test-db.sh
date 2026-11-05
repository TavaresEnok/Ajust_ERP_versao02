#!/usr/bin/env bash
# Banco descartável novo, sem copiar dados reais. Sempre removido ao terminar.
set -euo pipefail
cd "$(dirname "$0")/.."
TEST_CONTAINER="ajust_ci_test_$$"
trap 'docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true' EXIT
# Credencial exclusiva do contêiner descartável, ligado só ao loopback.
docker run -d --name "$TEST_CONTAINER" -e POSTGRES_PASSWORD=ci_test_only -e POSTGRES_DB=ajust_ci \
  -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$TEST_CONTAINER" pg_isready -U postgres -d ajust_ci >/dev/null 2>&1; then break; fi
  sleep 1
done
TEST_PORT=$(docker port "$TEST_CONTAINER" 5432/tcp | sed 's/.*://')
export DATABASE_URL="postgresql://postgres:ci_test_only@127.0.0.1:${TEST_PORT}/ajust_ci?schema=public"
export NODE_ENV=test
export PROCESS_DB_TESTS=1 REGISTRY_DB_TESTS=1
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
node scripts/seed-test-db.cjs
corepack pnpm --filter @ajust/api exec jest --runInBand --testPathPatterns=integration "$@"
