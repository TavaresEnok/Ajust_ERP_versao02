#!/bin/bash
set -euo pipefail
umask 077
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
POSTGRES_USER="${POSTGRES_USER:-ajust}"
POSTGRES_DB="${POSTGRES_DB:-ajust_erp}"
BACKUP_FILE="$BACKUP_DIR/${POSTGRES_DB}_$TIMESTAMP.dump"

TEMP_FILE=$(mktemp "$BACKUP_DIR/.dump.XXXXXX")
trap 'rm -f "$TEMP_FILE"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
  --format=custom \
  --no-owner \
  --username="$POSTGRES_USER" \
  "$POSTGRES_DB" > "$TEMP_FILE"

test -s "$TEMP_FILE"
chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$BACKUP_FILE"
echo "Backup salvo com sucesso em: $BACKUP_FILE"

# Retenção automática de 30 dias para evitar esgotamento de disco
echo "Limpando backups com mais de 30 dias..."
find "$BACKUP_DIR" -type f -name "${POSTGRES_DB}_*.dump" -mtime +30 -exec rm -f {} +
echo "Rotina de backup concluída."
