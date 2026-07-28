#!/usr/bin/env bash
# Stamp release install + quarantine scripts / macOS README.
# Usage:
#   stamp-macos-quarantine-assets.sh <version> <outdir>
set -euo pipefail

VERSION="${1:?version required (e.g. 1.2.3)}"
OUT_DIR="${2:?output directory required}"
REPO="${GITHUB_REPOSITORY:-midrissi/4d-dataexplorer}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAG="v${VERSION#v}"
VERSION_NUM="${VERSION#v}"

FIX_NAME="fix-macos-quarantine.sh"
INSTALL_SH="install-desktop.sh"
INSTALL_PS1="install-desktop.ps1"

FIX_URL="https://github.com/${REPO}/releases/download/${TAG}/${FIX_NAME}"
INSTALL_SH_URL="https://github.com/${REPO}/releases/download/${TAG}/${INSTALL_SH}"
INSTALL_PS1_URL="https://github.com/${REPO}/releases/download/${TAG}/${INSTALL_PS1}"
FIX_LATEST="https://github.com/${REPO}/releases/latest/download/${FIX_NAME}"
INSTALL_SH_LATEST="https://github.com/${REPO}/releases/latest/download/${INSTALL_SH}"
INSTALL_PS1_LATEST="https://github.com/${REPO}/releases/latest/download/${INSTALL_PS1}"

mkdir -p "$OUT_DIR"

stamp() {
  local src="$1"
  local dest="$2"
  sed \
    -e "s|__APP_VERSION__|${VERSION_NUM}|g" \
    -e "s|__APP_TAG__|${TAG}|g" \
    -e "s|__REPO__|${REPO}|g" \
    -e "s|__FIX_SCRIPT_URL__|${FIX_URL}|g" \
    -e "s|__INSTALL_SCRIPT_URL__|${INSTALL_SH_URL}|g" \
    -e "s|__INSTALL_PS1_URL__|${INSTALL_PS1_URL}|g" \
    -e "s|${FIX_LATEST}|${FIX_URL}|g" \
    -e "s|${INSTALL_SH_LATEST}|${INSTALL_SH_URL}|g" \
    -e "s|${INSTALL_PS1_LATEST}|${INSTALL_PS1_URL}|g" \
    "$src" >"$dest"
}

stamp "$SCRIPT_DIR/${FIX_NAME}" "$OUT_DIR/${FIX_NAME}"
stamp "$SCRIPT_DIR/${INSTALL_SH}" "$OUT_DIR/${INSTALL_SH}"
stamp "$SCRIPT_DIR/${INSTALL_PS1}" "$OUT_DIR/${INSTALL_PS1}"
stamp "$SCRIPT_DIR/macos-readme.html" "$OUT_DIR/README.html"
chmod +x "$OUT_DIR/${FIX_NAME}" "$OUT_DIR/${INSTALL_SH}"

echo "script_path=$OUT_DIR/${FIX_NAME}"
echo "install_sh_path=$OUT_DIR/${INSTALL_SH}"
echo "install_ps1_path=$OUT_DIR/${INSTALL_PS1}"
echo "readme_path=$OUT_DIR/README.html"
echo "script_url=$FIX_URL"
echo "install_sh_url=$INSTALL_SH_URL"
echo "install_ps1_url=$INSTALL_PS1_URL"
echo "tag=$TAG"
