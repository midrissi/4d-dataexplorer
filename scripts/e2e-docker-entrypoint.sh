#!/bin/bash
set -e

export PORT="${PORT:-4173}"
export REST_PORT="${REST_PORT:-7081}"
export DATAEXPLORER_URL="${DATAEXPLORER_URL:-http://localhost:${PORT}}"
export CI="${CI:-true}"

# Playwright webServer runs scripts/e2e-serve.sh (built app via http-server + rest-server API).
cd packages/e2e && exec npx playwright test "$@"
