#!/bin/bash
set -e

export PORT="${PORT:-7080}"
export DATAEXPLORER_URL="${DATAEXPLORER_URL:-http://localhost:${PORT}}"

# Start rest-server in background
cd packages/rest-server
bun run dev > rest-server.log 2>&1 &
echo $! > rest-server.pid
cd ../..

# Wait for server to be ready
echo "Waiting for rest-server at ${DATAEXPLORER_URL}..."
timeout 30 bash -c "until curl -sf ${DATAEXPLORER_URL}/health >/dev/null; do sleep 1; done" || {
  echo "rest-server failed to become ready"
  cat packages/rest-server/rest-server.log 2>/dev/null || true
  exit 1
}

curl -sf "${DATAEXPLORER_URL}/health" || exit 1
curl -sf "${DATAEXPLORER_URL}/dataexplorer/" || exit 1
echo "rest-server is ready."

# Run Playwright tests (use npx so Playwright runs under Node, matching CI)
cd packages/e2e && exec npx playwright test "$@"
