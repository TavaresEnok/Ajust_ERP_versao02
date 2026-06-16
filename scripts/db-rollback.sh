#!/bin/bash
# Database rollback helper using Prisma migrate
# Usage:
#   ./scripts/db-rollback.sh list           — List applied migrations
#   ./scripts/db-rollback.sh status         — Show migration status
#   ./scripts/db-rollback.sh mark-rolled-back <migration_name>  — Mark a migration as rolled back
#   ./scripts/db-rollback.sh restore <backup_file>              — Restore from pg_dump backup
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }

SCHEMA="${SCHEMA:-prisma/schema.prisma}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL must be set}"

usage() {
  echo ""
  echo "  Database Rollback Utility"
  echo ""
  echo "  Commands:"
  echo "    list                                — List all applied migrations"
  echo "    status                              — Show full migration status"
  echo "    mark-rolled-back <migration_name>   — Mark a migration as rolled back (use after manual SQL rollback)"
  echo "    restore <backup_file>               — Drop and restore from a pg_dump backup file"
  echo ""
  echo "  IMPORTANT: Prisma does NOT support automatic SQL rollback."
  echo "  The recommended workflow is:"
  echo "    1. Take a backup before migration: ./scripts/db-backup.sh"
  echo "    2. If migration fails: restore from backup using this script"
  echo "    3. Mark the failed migration as rolled back"
  echo ""
  exit 1
}

cmd="${1:-}"

case "$cmd" in
  list)
    log_step "Listing applied migrations..."
    pnpm exec prisma migrate status --schema "$SCHEMA" | grep "Database migration status" -A 100
    ;;

  status)
    log_step "Migration status:"
    pnpm exec prisma migrate status --schema "$SCHEMA"
    ;;

  mark-rolled-back)
    MIGRATION="${2:?Usage: $0 mark-rolled-back <migration_name>}"
    log_warn "This marks migration '$MIGRATION' as rolled back in _prisma_migrations."
    log_warn "You must have ALREADY manually reverted the schema changes in the database."
    read -r -p "Continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      log_info "Aborted."
      exit 0
    fi
    log_step "Marking migration as rolled back..."
    pnpm exec prisma migrate resolve --rolled-back "$MIGRATION" --schema "$SCHEMA"
    log_info "Migration '$MIGRATION' marked as rolled back."
    log_info "Run '$0 status' to verify."
    ;;

  restore)
    BACKUP_FILE="${2:?Usage: $0 restore <backup_file>}"
    if [ ! -f "$BACKUP_FILE" ]; then
      log_error "Backup file not found: $BACKUP_FILE"
      exit 1
    fi

    # Parse connection details from DATABASE_URL
    # Format: postgresql://user:pass@host:port/dbname?schema=public
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

    log_warn "This will DROP and RESTORE the database '$DB_NAME' on $DB_HOST:$DB_PORT"
    log_warn "ALL current data will be lost. This is irreversible."
    read -r -p "Type the database name to confirm ('$DB_NAME'): " CONFIRM
    if [ "$CONFIRM" != "$DB_NAME" ]; then
      log_info "Confirmation did not match. Aborted."
      exit 0
    fi

    log_step "Dropping and recreating database '$DB_NAME'..."
    DB_PASSWORD=$(node -e "const u=new URL(process.env.DATABASE_URL); process.stdout.write(decodeURIComponent(u.password))")
    ADMIN_DB="${ADMIN_DB:-postgres}"
    PGPASSWORD="$DB_PASSWORD" \
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB" -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
    PGPASSWORD="$DB_PASSWORD" \
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB" -c "CREATE DATABASE \"$DB_NAME\";"

    log_step "Restoring from backup: $BACKUP_FILE"
    PGPASSWORD="$DB_PASSWORD" \
      pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --role="$DB_USER" "$BACKUP_FILE"

    log_info "Database restored successfully from $BACKUP_FILE"
    log_step "Running prisma migrate status to verify..."
    pnpm exec prisma migrate status --schema "$SCHEMA" || true
    ;;

  *)
    usage
    ;;
esac
