#!/usr/bin/env bash
set -Eeuo pipefail
JOURNEY_PROJECT=gestao bash "$(dirname "$0")/test-analyst-journey.sh" "$@"
