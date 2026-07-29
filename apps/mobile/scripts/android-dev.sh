#!/usr/bin/env bash
# Prepare Android gen (icons + label + splash), then run tauri android:dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash "$ROOT/scripts/android-prepare.sh"

exec bunx tauri android dev "$@"
