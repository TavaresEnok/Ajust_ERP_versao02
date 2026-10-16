#!/bin/bash
# ==============================================================================
# Ajust ERP — Database Restore Script (OPS-01)
# Restores a PostgreSQL dump produced by scripts/db-backup.sh.
#
# Usage:
#   ./scripts/db-restore.sh [backup_file] [--force]
#
# Examples:
#   ./scripts/db-restore.sh                                  # Restores latest backup with prompt
#   ./scripts/db-restore.sh ./backups/ajust_erp_latest.dump  # Restores specific backup with prompt
#   ./scripts/db-restore.sh ./backups/ajust_erp_latest.dump --force # Non-interactive / CI
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_USER="${POSTGRES_USER:-ajust}"
POSTGRES_DB="${POSTGRES_DB:-ajust_erp}"
SCHEMA="${SCHEMA:-prisma/schema.prisma}"

FORCE=false
BACKUP_FILE=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --force|-f|-y|--yes)
      FORCE=true
      ;;
    *)
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$arg"
      fi
      ;;
  esac
done

# If no backup file was specified, pick the latest dump from BACKUP_DIR
if [ -z "$BACKUP_FILE" ]; then
  if [ -d "$BACKUP_DIR" ]; then
    LATEST_DUMP=$(find "$BACKUP_DIR" -type f -name "${POSTGRES_DB}_*.dump" 2>/dev/null | sort -r | head -n 1 || true)
    if [ -n "$LATEST_DUMP" ]; then
      BACKUP_FILE="$LATEST_DUMP"
      log_info "No backup file specified. Auto-selected latest backup: ${BOLD}$BACKUP_FILE${NC}"
    fi
  fi
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file not found or not specified: '${BACKUP_FILE:-none}'"
  echo ""
  echo "Available backups in $BACKUP_DIR:"
  ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null || echo "  (no backups found in $BACKUP_DIR)"
  echo ""
  echo "Usage: $0 [path/to/backup.dump] [--force]"
  exit 1
fi

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_step "Preparing to restore backup: ${BOLD}$BACKUP_FILE${NC} ($FILE_SIZE)"

# Safety confirmation unless --force is used
if [ "$FORCE" != "true" ]; then
  echo ""
  log_warn "This operation will REPLACE all existing data in database '${BOLD}$POSTGRES_DB${NC}'."
  read -r -p "Type the database name to confirm restore ('$POSTGRES_DB'): " CONFIRM
  if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
    log_info "Confirmation mismatch. Restore cancelled."
    exit 0
  fi
fi

START_TIME=$(date +%s)

# 1. Terminate existing client connections to avoid drop/restore locks
log_step "1/4 Terminating active connections to '$POSTGRES_DB'..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '$POSTGRES_DB'
    AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

# 2. Recreate target database
log_step "2/4 Recreating clean database '$POSTGRES_DB'..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "
  DROP DATABASE IF EXISTS \"$POSTGRES_DB\";
" >/dev/null
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "
  CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";
" >/dev/null

# 3. Stream dump into pg_restore
log_step "3/4 Restoring schema and data from dump file..."
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_restore \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --no-owner \
  --role="$POSTGRES_USER" \
  < "$BACKUP_FILE"

# 4. Verification and Health Check
log_step "4/4 Verifying restore integrity..."
TABLE_COUNT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
" | tr -d '[:space:]')

ORDER_COUNT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
  SELECT count(*) FROM \"ServiceOrder\";
" 2>/dev/null | tr -d '[:space:]' || echo "N/A")

TENANT_COUNT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
  SELECT count(*) FROM \"Tenant\";
" 2>/dev/null | tr -d '[:space:]' || echo "N/A")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_info "Restore verification:"
echo "  - Public tables: $TABLE_COUNT"
echo "  - Tenants:       $TENANT_COUNT"
echo "  - ServiceOrders: $ORDER_COUNT"
echo "  - Elapsed time:  ${DURATION}s"

if [ -f "$SCHEMA" ]; then
  log_step "Checking Prisma schema compatibility..."
  pnpm exec prisma migrate status --schema "$SCHEMA" || true
fi

echo ""
log_info "${BOLD}Database successfully restored and verified from $BACKUP_FILE!${NC}"
