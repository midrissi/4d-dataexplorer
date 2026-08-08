#!/usr/bin/env bash
# Serve the built DataExplorer for Playwright e2e:
#   - stage DataBrowser under .e2e-static/dataexplorer/ (vite base is /dataexplorer/)
#   - rest-server on REST_PORT for /rest, /api, /health
#   - bunx http-server on PORT with --proxy fallback to rest-server
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-4173}"
REST_PORT="${REST_PORT:-7081}"
STATIC_ROOT="${E2E_STATIC_ROOT:-$ROOT/.e2e-static}"
DEFAULT_BROWSER="$ROOT/apps/dataexplorer/DataBrowser"
ROOT_BROWSER="$ROOT/DataBrowser"

resolve_data_browser() {
  if [ -f "$DEFAULT_BROWSER/index.html" ]; then
    echo "$DEFAULT_BROWSER"
    return
  fi
  if [ -f "$ROOT_BROWSER/index.html" ]; then
    echo "$ROOT_BROWSER"
    return
  fi
  return 1
}

if ! DATA_BROWSER="$(resolve_data_browser)"; then
  echo "Building DataExplorer (DataBrowser not found)..."
  bun --filter @4d/dataexplorer build
  DATA_BROWSER="$DEFAULT_BROWSER"
fi

if [ ! -f "$DATA_BROWSER/index.html" ]; then
  echo "error: missing $DATA_BROWSER/index.html after build" >&2
  exit 1
fi

echo "Staging built DataExplorer from $DATA_BROWSER → $STATIC_ROOT/dataexplorer/"
rm -rf "$STATIC_ROOT"
mkdir -p "$STATIC_ROOT/dataexplorer"
cp -R "$DATA_BROWSER"/. "$STATIC_ROOT/dataexplorer/"

REST_LOG="$STATIC_ROOT/rest-server.log"
(
  cd "$ROOT/packages/rest-server"
  PORT="$REST_PORT" bun run dev >"$REST_LOG" 2>&1
) &
REST_PID=$!

cleanup() {
  if kill -0 "$REST_PID" 2>/dev/null; then
    kill "$REST_PID" 2>/dev/null || true
    wait "$REST_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Waiting for rest-server on :$REST_PORT..."
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${REST_PORT}/health" >/dev/null; then
    break
  fi
  if ! kill -0 "$REST_PID" 2>/dev/null; then
    echo "error: rest-server exited early" >&2
    cat "$REST_LOG" >&2 || true
    exit 1
  fi
  sleep 0.5
done

if ! curl -sf "http://127.0.0.1:${REST_PORT}/health" >/dev/null; then
  echo "error: rest-server did not become ready on :$REST_PORT" >&2
  cat "$REST_LOG" >&2 || true
  exit 1
fi

echo "Serving built DataExplorer at http://127.0.0.1:${PORT}/dataexplorer/ (API → :$REST_PORT)"
exec bunx http-server "$STATIC_ROOT" \
  -p "$PORT" \
  -a 0.0.0.0 \
  -c-1 \
  -s \
  -P "http://127.0.0.1:${REST_PORT}"
