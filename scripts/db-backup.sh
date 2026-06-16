#!/bin/bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
POSTGRES_USER="${POSTGRES_USER:-ajust}"
POSTGRES_DB="${POSTGRES_DB:-ajust_erp}"
BACKUP_FILE="$BACKUP_DIR/${POSTGRES_DB}_$TIMESTAMP.dump"

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
  --format=custom \
  --no-owner \
  --username="$POSTGRES_USER" \
  "$POSTGRES_DB" > "$BACKUP_FILE"

test -s "$BACKUP_FILE"
echo "Backup saved to $BACKUP_FILE"
