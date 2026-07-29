#!/usr/bin/env bash
# Invoked by the Xcode "Build Rust Code" phase.
#
# IMPORTANT: cwd must stay under gen/apple (or be gen/apple). The Tauri CLI's
# `ios xcode-script` walks cwd.parent().parent() when not launched via npm/pnpm
# lifecycle — from gen/apple that resolves to src-tauri. If we start from
# apps/mobile it resolves to the monorepo root and loads the desktop app
# (com.4d.dataexplorer) instead of mobile (com.fourd.dataexplorer.mobile),
# which breaks the CLI-options WebSocket handshake.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
GEN_APPLE="$ROOT/src-tauri/gen/apple"

if [[ -n "${TAURI_IOS_TMPDIR:-}" ]]; then
  export TMPDIR="$TAURI_IOS_TMPDIR"
fi
mkdir -p "${TMPDIR:-/tmp}"

export HOME="${HOME:-/Users/$(id -un)}"
export PATH="${HOME}/.bun/bin:${HOME}/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"

BUN_BIN="$(command -v bun)"
TAURI_JS="$REPO_ROOT/node_modules/@tauri-apps/cli/tauri.js"
if [[ ! -f "$TAURI_JS" ]]; then
  TAURI_JS="$ROOT/node_modules/@tauri-apps/cli/tauri.js"
fi
if [[ ! -f "$TAURI_JS" ]]; then
  echo "error: @tauri-apps/cli tauri.js not found" >&2
  exit 1
fi

cd "$GEN_APPLE"
exec "$BUN_BIN" "$TAURI_JS" ios xcode-script "$@"
