#!/bin/bash
# Volta api/worker/web para as imagens publicadas de um commit anterior.
#
# O docker-compose.prod.yml só usa imagens do registry (não tem `build:`), então o rollback
# troca a tag (IMAGE_TAG = SHA completo do commit, como o deploy.yml publica) em vez de
# fazer checkout + build. Migrations não são revertidas: precisam ser compatíveis com a
# versão anterior. Para desfazer o último deploy automático, prefira
# `scripts/deploy-images.sh rollback`, que usa os digests gravados no deploy.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
  echo "Usage: $0 <git-tag-or-commit-hash>"
  echo "Example: $0 v0.1.0"
  exit 1
}

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICES=(api worker web)

if [ $# -lt 1 ]; then
  log_error "Missing argument: git tag or commit hash required."
  usage
fi

TARGET="$1"

if ! git rev-parse --verify "${TARGET}^{commit}" > /dev/null 2>&1; then
  log_error "Ref '${TARGET}' not found in repository."
  exit 1
fi

IMAGE_TAG=$(git rev-parse "${TARGET}^{commit}")
export IMAGE_TAG
log_info "Rolling back ${SERVICES[*]} to images tagged ${IMAGE_TAG}"

log_info "Pulling images..."
if ! docker compose -f "${COMPOSE_FILE}" pull "${SERVICES[@]}"; then
  log_error "Images for ${IMAGE_TAG} not found in the registry. Nothing was changed."
  exit 1
fi

log_info "Recreating services and waiting for health checks (max 180s)..."
if docker compose -f "${COMPOSE_FILE}" up -d --no-deps --force-recreate \
  --wait --wait-timeout 180 "${SERVICES[@]}"; then
  log_info "Rollback to ${TARGET} (${IMAGE_TAG:0:7}) complete."
  exit 0
fi

log_warn "Services did not become healthy. Check 'docker compose -f ${COMPOSE_FILE} ps'."
exit 1
