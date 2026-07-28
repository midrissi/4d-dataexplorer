#!/usr/bin/env bash
# Stamp release placeholders in the macOS quarantine fix script / README.
# Usage:
#   stamp-macos-quarantine-assets.sh <version> <outdir>
# Example:
#   stamp-macos-quarantine-assets.sh 1.2.3 ./out
set -euo pipefail

VERSION="${1:?version required (e.g. 1.2.3)}"
OUT_DIR="${2:?output directory required}"
REPO="${GITHUB_REPOSITORY:-midrissi/4d-dataexplorer}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAG="v${VERSION#v}"
VERSION_NUM="${VERSION#v}"
SCRIPT_NAME="fix-macos-quarantine.sh"
LATEST_URL="https://github.com/${REPO}/releases/latest/download/${SCRIPT_NAME}"
SCRIPT_URL="https://github.com/${REPO}/releases/download/${TAG}/${SCRIPT_NAME}"

mkdir -p "$OUT_DIR"

stamp() {
  local src="$1"
  local dest="$2"
  sed \
    -e "s|__APP_VERSION__|${VERSION_NUM}|g" \
    -e "s|__APP_TAG__|${TAG}|g" \
    -e "s|__FIX_SCRIPT_URL__|${SCRIPT_URL}|g" \
    -e "s|${LATEST_URL}|${SCRIPT_URL}|g" \
    "$src" >"$dest"
}

stamp "$SCRIPT_DIR/fix-macos-quarantine.sh" "$OUT_DIR/${SCRIPT_NAME}"
stamp "$SCRIPT_DIR/macos-readme.html" "$OUT_DIR/README.html"
chmod +x "$OUT_DIR/${SCRIPT_NAME}"

echo "script_path=$OUT_DIR/${SCRIPT_NAME}"
echo "readme_path=$OUT_DIR/README.html"
echo "script_url=$SCRIPT_URL"
echo "tag=$TAG"
