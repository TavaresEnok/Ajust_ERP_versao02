#!/bin/bash
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
SERVICES="web api worker"

if [ $# -lt 1 ]; then
  log_error "Missing argument: git tag or commit hash required."
  usage
fi

TARGET="$1"
shift

log_info "Rolling back to: ${TARGET}"

log_info "Verifying ref exists..."
if ! git rev-parse --verify "${TARGET}^{commit}" > /dev/null 2>&1; then
  log_error "Ref '${TARGET}' not found in repository."
  exit 1
fi

ACTUAL_COMMIT=$(git rev-parse --short "${TARGET}^{commit}")
log_info "Resolved to commit: ${ACTUAL_COMMIT}"

log_info "Stopping services: ${SERVICES}..."
docker compose -f "${COMPOSE_FILE}" stop ${SERVICES} || {
  log_error "Failed to stop services."
  exit 1
}

log_info "Checking out ${TARGET}..."
git checkout "${TARGET}" || {
  log_error "Failed to checkout ${TARGET}. Attempting to restart services..."
  docker compose -f "${COMPOSE_FILE}" up -d ${SERVICES}
  exit 1
}

log_info "Rebuilding Docker images..."
docker compose -f "${COMPOSE_FILE}" build ${SERVICES} || {
  log_error "Build failed. Attempting to restart services with existing images..."
  docker compose -f "${COMPOSE_FILE}" up -d ${SERVICES}
  exit 1
}

log_info "Starting services: ${SERVICES}..."
docker compose -f "${COMPOSE_FILE}" up -d ${SERVICES}

log_info "Waiting for health checks (max 120s)..."

MAX_WAIT=120
INTERVAL=5
ELAPSED=0

while [ ${ELAPSED} -lt ${MAX_WAIT} ]; do
  ALL_HEALTHY=true
  for SVC in ${SERVICES}; do
    STATUS=$(docker compose -f "${COMPOSE_FILE}" ps --format json "${SVC}" 2>/dev/null | \
      python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
    if [ "${STATUS}" != "healthy" ]; then
      ALL_HEALTHY=false
      break
    fi
  done

  if ${ALL_HEALTHY}; then
    log_info "All services healthy. Rollback to ${TARGET} (${ACTUAL_COMMIT}) complete."
    exit 0
  fi

  sleep ${INTERVAL}
  ELAPSED=$((ELAPSED + INTERVAL))
  log_info "Waiting... (${ELAPSED}s / ${MAX_WAIT}s)"
done

log_warn "Timeout waiting for health checks. Services may still be starting."
log_warn "Rollback to ${TARGET} (${ACTUAL_COMMIT}) attempted. Check 'docker compose ps'."
exit 1
