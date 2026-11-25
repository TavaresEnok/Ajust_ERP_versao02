#!/usr/bin/env bash
# Backup completo do Ajust ERP (auditoria C-076, C-058): banco validado, uploads, segredos
# (chave do cofre + .env) e hashes. Roda todo dia pelo cron do usuário app.
#
# Segredos: a chave do cofre NUNCA fica em claro ao lado do dump (senão quem pega o backup
# lê o cofre). Com BACKUP_PASSPHRASE_FILE (padrão $ROOT/backup.pass, chmod 600, guardada
# também fora do servidor) eles vão criptografados em secrets.tar.enc:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:backup.pass \
#     -in secrets.tar.enc | tar -x
# Sem a senha, ficam só em $ROOT/secrets-local/ (fora da pasta enviada) e o log avisa.
#
# Cópia para fora do servidor: crie /home/app/backups/ajust_erp/destino.conf com
#   BACKUP_REMOTE=usuario@host:/caminho/ajust_erp      (rsync por SSH, com chave sem senha)
# A cópia remota nunca apaga nada no destino (sem --delete): a retenção remota é do destino.
# Sem destino o script termina com código 3, para o cron acusar (BACKUP_ALLOW_LOCAL_ONLY=1
# aceita backup só local).
set -euo pipefail
umask 077

PROJECT=/home/app/projects/Ajust_ERP
ROOT=${BACKUP_ROOT:-/home/app/backups/ajust_erp}
DEST="$ROOT/auto/$(date +%Y%m%d_%H%M%S)"
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
PG=${PG_CONTAINER:-ajust_erp-postgres-1}
if [ -z "${VAULT_KEY_HOST_FILE:-}" ] && [ -f "$PROJECT/.env" ]; then
  VAULT_KEY_HOST_FILE=$(grep -E '^VAULT_KEY_HOST_FILE=' "$PROJECT/.env" | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
VAULT_KEY_SOURCE="${VAULT_KEY_HOST_FILE:-/home/app/secrets/ajust_erp/vault.key}"
PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-$ROOT/backup.pass}"
log() { echo "[$(date -Iseconds)] $*"; }

mkdir -p "$DEST"
chmod 700 "$ROOT" "$ROOT/auto" "$DEST"
trap 'log "FALHOU: backup incompleto em $DEST"; rm -rf "$DEST"' ERR

[ -r "$VAULT_KEY_SOURCE" ] || { log "chave do cofre ausente em $VAULT_KEY_SOURCE"; exit 1; }

docker exec "$PG" sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$DEST/ajust_erp.dump"
TABLES=$(docker exec -i "$PG" pg_restore --list < "$DEST/ajust_erp.dump" | grep -c 'TABLE DATA')
[ "$TABLES" -gt 0 ] || { log "dump sem tabelas"; exit 1; }

tar --exclude='uploads/.keys' -C "$PROJECT" -czf "$DEST/uploads.tgz" uploads
STAMP=$(basename "$DEST")
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp "$VAULT_KEY_SOURCE" "$STAGE/vault.key"
cp "$PROJECT/.env" "$STAGE/env"
if [ -r "$PASSPHRASE_FILE" ]; then
  tar -C "$STAGE" -cf - vault.key env \
    | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$PASSPHRASE_FILE" \
      -out "$DEST/secrets.tar.enc"
  (cd "$DEST" && sha256sum ajust_erp.dump uploads.tgz secrets.tar.enc > SHA256SUMS)
else
  mkdir -p "$ROOT/secrets-local/$STAMP"
  chmod 700 "$ROOT/secrets-local" "$ROOT/secrets-local/$STAMP"
  cp "$STAGE/vault.key" "$STAGE/env" "$ROOT/secrets-local/$STAMP/"
  chmod 600 "$ROOT/secrets-local/$STAMP"/*
  log "AVISO: sem $PASSPHRASE_FILE; chave do cofre e .env ficaram só em $ROOT/secrets-local/$STAMP (não vão para a cópia externa)."
  (cd "$DEST" && sha256sum ajust_erp.dump uploads.tgz > SHA256SUMS)
fi
chmod 600 "$DEST"/*
trap - ERR
log "ok: $DEST ($TABLES tabelas)"

find "$ROOT/auto" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
[ -d "$ROOT/secrets-local" ] && \
  find "$ROOT/secrets-local" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +

if [ -f "$ROOT/destino.conf" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/destino.conf"
fi
if [ -n "${BACKUP_REMOTE:-}" ]; then
  # Sem --delete: uma exclusão acidental (ou ransomware) aqui não se propaga para o destino.
  rsync -a "$ROOT/auto/" "$BACKUP_REMOTE/" && log "cópia externa ok: $BACKUP_REMOTE"
else
  log "AVISO: sem BACKUP_REMOTE em $ROOT/destino.conf; backup só local (C-076)."
  [ "${BACKUP_ALLOW_LOCAL_ONLY:-0}" = "1" ] || exit 3
fi
