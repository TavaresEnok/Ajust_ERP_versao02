#!/usr/bin/env bash
# Backup completo do Ajust ERP (auditoria C-076, C-058): banco validado, uploads (com a chave
# do cofre), .env e hashes. Roda todo dia pelo cron do usuário app.
#
# Cópia para fora do servidor: crie /home/app/backups/ajust_erp/destino.conf com
#   BACKUP_REMOTE=usuario@host:/caminho/ajust_erp      (rsync por SSH, com chave sem senha)
# Sem esse arquivo, o backup fica só local e o log avisa.
set -euo pipefail
umask 077

PROJECT=/home/app/projects/Ajust_ERP
ROOT=${BACKUP_ROOT:-/home/app/backups/ajust_erp}
DEST="$ROOT/auto/$(date +%Y%m%d_%H%M%S)"
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
PG=${PG_CONTAINER:-ajust_erp-postgres-1}
log() { echo "[$(date -Iseconds)] $*"; }

mkdir -p "$DEST"
chmod 700 "$ROOT" "$ROOT/auto" "$DEST"
trap 'log "FALHOU: backup incompleto em $DEST"; rm -rf "$DEST"' ERR

docker exec "$PG" sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$DEST/ajust_erp.dump"
TABLES=$(docker exec -i "$PG" pg_restore --list < "$DEST/ajust_erp.dump" | grep -c 'TABLE DATA')
[ "$TABLES" -gt 0 ] || { log "dump sem tabelas"; exit 1; }

tar -C "$PROJECT" -czf "$DEST/uploads.tgz" uploads
cp "$PROJECT/uploads/.keys/vault.key" "$DEST/vault.key"
cp "$PROJECT/.env" "$DEST/env"
(cd "$DEST" && sha256sum ajust_erp.dump uploads.tgz vault.key env > SHA256SUMS)
chmod 600 "$DEST"/*
trap - ERR
log "ok: $DEST ($TABLES tabelas)"

find "$ROOT/auto" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +

if [ -f "$ROOT/destino.conf" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/destino.conf"
fi
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rsync -a --delete "$ROOT/auto/" "$BACKUP_REMOTE/" && log "cópia externa ok: $BACKUP_REMOTE"
else
  log "AVISO: sem BACKUP_REMOTE em $ROOT/destino.conf; backup só local (C-076)."
fi
