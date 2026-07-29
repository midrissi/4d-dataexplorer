#!/usr/bin/env bash
# Init Android gen if needed, apply splash, then run tauri android:dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GEN_ANDROID="$ROOT/src-tauri/gen/android"
if [[ ! -d "$GEN_ANDROID" ]]; then
  echo "Initializing Android project…"
  bunx tauri android init --ci --skip-targets-install
fi

bash "$ROOT/scripts/patch-mobile-splash.sh"

exec bunx tauri android dev "$@"
