#!/bin/sh
set -e
echo "[start-api] Running Prisma migrations..."
# Use migrations instead of db push to prevent data loss
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma 2>&1 || {
  echo "[start-api] WARNING: prisma migrate deploy failed. This may indicate database connectivity issues."
  echo "[start-api] Ensure DATABASE_URL is correctly set and database is accessible."
  exit 1
}
echo "[start-api] Starting API server..."
exec node apps/api/dist/main.js
