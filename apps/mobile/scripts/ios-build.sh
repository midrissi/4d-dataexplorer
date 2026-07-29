#!/usr/bin/env bash
# Reliable `tauri ios build` wrapper (simulator by default).
#
# Pins TMPDIR for parent + Xcode script and routes the Build Rust Code phase
# through scripts/ios-xcode-script.sh (see ios-prepare-xcode.sh).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ios-prepare-xcode.sh
source "$SCRIPT_DIR/ios-prepare-xcode.sh"

ARGS=("--target" "aarch64-sim" "--ci")
if [[ $# -gt 0 ]]; then
  ARGS=("$@")
fi

# Tauri's iOS simulator export path uses a rename from xcarchive into
# gen/apple/build/<arch>/<Product>.app, which fails with:
# "Directory not empty (os error 66)" when a previous app folder exists.
# Clear stale simulator outputs before invoking the build.
PRODUCT_NAME="$(
  node -e "const c=JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')); console.log(c.productName || c.mainBinaryName || 'App')"
)"
for sim_arch in arm64-sim x86_64-sim; do
  sim_out="$GEN_APPLE/build/${sim_arch}/${PRODUCT_NAME}.app"
  if [[ -d "$sim_out" ]]; then
    rm -rf "$sim_out"
  fi
done

echo "Running: bunx tauri ios build ${ARGS[*]}"
exec bunx tauri ios build "${ARGS[@]}"
