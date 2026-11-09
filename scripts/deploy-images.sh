#!/usr/bin/env bash
# Restore application images only. Database migrations must remain backward compatible.
set -Eeuo pipefail
umask 077
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STATE_DIR="${DEPLOY_STATE_DIR:-.deploy}"
DEPLOY_ID="${DEPLOY_ID:-manual}"
[[ "$DEPLOY_ID" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid deployment ID.' >&2; exit 1; }
STATE_FILE="$STATE_DIR/$(basename "$COMPOSE_FILE").$DEPLOY_ID.previous.json"
mkdir -p "$STATE_DIR"
compose_args=(-f "$COMPOSE_FILE")
if [[ "$COMPOSE_FILE" == *staging* ]]; then
  export DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.staging}"
  export POSTGRES_USER="${POSTGRES_USER:-ajust_staging}"
  export POSTGRES_DB="${POSTGRES_DB:-ajust_staging}"
fi
if [[ -n "${DEPLOY_ENV_FILE:-}" ]]; then compose_args=(--env-file "$DEPLOY_ENV_FILE" "${compose_args[@]}"); fi
compose() { docker compose "${compose_args[@]}" "$@"; }

rollback() {
  if [[ ! -s "$STATE_FILE" ]]; then
    echo 'No previous application images recorded; rollback unavailable.' >&2
    return 1
  fi
  docker compose "${compose_args[@]}" -f "$STATE_FILE" up -d --no-deps \
    --force-recreate --wait --wait-timeout 180 api worker web
}

if [[ "${1:-}" == rollback ]]; then
  rollback
  exit
fi

snapshot=$(mktemp "$STATE_DIR/.previous.XXXXXX")
trap 'rm -f "$snapshot"' EXIT
printf '{"services":{' > "$snapshot"
separator=''
for service in api worker web; do
  container=$(compose ps -q "$service")
  if [[ -z "$container" ]]; then
    echo "Cannot deploy without a running $service to restore." >&2
    exit 1
  fi
  image=$(docker inspect --format '{{.Image}}' "$container")
  [[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid image digest.' >&2; exit 1; }
  printf '%s"%s":{"image":"%s","pull_policy":"never"}' "$separator" "$service" "$image" >> "$snapshot"
  separator=','
done
printf '}}\n' >> "$snapshot"
mv "$snapshot" "$STATE_FILE"
trap 'trap - ERR; echo "Deployment failed; restoring previous application images." >&2; rollback; exit 1' ERR

COMPOSE_FILE="$COMPOSE_FILE" bash scripts/db-backup.sh
compose pull api worker web
compose run --rm --no-deps api \
  sh -c './node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker web
