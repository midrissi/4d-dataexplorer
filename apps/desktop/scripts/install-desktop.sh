#!/usr/bin/env bash
# Install Data Explorer from the GitHub Release that stamped this script.
# Usage:
#   curl -fsSL __INSTALL_SCRIPT_URL__ | bash
set -euo pipefail

APP_VERSION="__APP_VERSION__"
APP_TAG="__APP_TAG__"
REPO="__REPO__"
DOCS_URL="https://midrissi.github.io/4d-dataexplorer/"

if [[ "$APP_VERSION" == __*__ ]]; then
  echo "❌  Download this script from a GitHub Release:"
  echo "    curl -fsSL https://github.com/midrissi/4d-dataexplorer/releases/latest/download/install-desktop.sh | bash"
  exit 1
fi

BASE="https://github.com/${REPO}/releases/download/${APP_TAG}"
API="https://api.github.com/repos/${REPO}/releases/tags/${APP_TAG}"

echo
echo "🛠  Data Explorer — install ${APP_TAG}"
echo "────────────────────────────────────────"
echo

pick_asset() {
  local pattern="$1"
  curl -fsSL -H "Accept: application/vnd.github+json" "$API" \
    | python3 -c "
import json, re, sys
pat = re.compile(sys.argv[1], re.I)
data = json.load(sys.stdin)
for a in data.get('assets', []):
    name = a.get('name') or ''
    if name.endswith('.sig') or name.endswith('.sha256'):
        continue
    if pat.search(name):
        print(a.get('browser_download_url') or '')
        break
" "$pattern"
}

install_macos() {
  local machine pattern url tmp
  machine="$(uname -m)"
  case "$machine" in
    arm64) pattern='aarch64.*\.zip$|arm64.*\.zip$' ;;
    x86_64) pattern='x86_64.*\.zip$|x64.*\.zip$' ;;
    *)
      echo "❌  Unsupported Mac architecture: $machine"
      exit 1
      ;;
  esac
  # Prefer our stamped ZIP name first (no API needed).
  case "$machine" in
    arm64) url="${BASE}/Data-Explorer_${APP_VERSION}_aarch64.zip" ;;
    x86_64) url="${BASE}/Data-Explorer_${APP_VERSION}_x86_64.zip" ;;
  esac
  tmp="$(mktemp -d)"
  echo "⬇️  Downloading macOS ZIP…"
  if ! curl -fL --progress-bar -o "${tmp}/app.zip" "$url"; then
    echo "   Falling back to GitHub API…"
    url="$(pick_asset "$pattern" || true)"
    if [ -z "$url" ]; then
      echo "❌  No macOS ZIP found for ${APP_TAG}"
      rm -rf "$tmp"
      exit 1
    fi
    curl -fL --progress-bar -o "${tmp}/app.zip" "$url"
  fi
  echo "📦  Extracting…"
  unzip -qo "${tmp}/app.zip" -d "${tmp}/out"
  local app
  app="$(find "${tmp}/out" -maxdepth 2 -type d -name '*.app' | head -n 1 || true)"
  if [ -z "$app" ]; then
    echo "❌  .app missing from archive"
    rm -rf "$tmp"
    exit 1
  fi
  echo "🧹  Clearing quarantine…"
  xattr -cr "$app"
  echo "📂  Installing to /Applications…"
  local dest="/Applications/$(basename "$app")"
  rm -rf "$dest"
  ditto "$app" "$dest"
  rm -rf "$tmp"
  echo "🚀  Opening…"
  open "$dest"
  echo
  echo "✅  Installed ${dest}"
  echo "📖  ${DOCS_URL}guide/macos-desktop"
  echo
}

install_linux() {
  local url dest
  echo "⬇️  Resolving Linux asset…"
  url="$(pick_asset '\.AppImage$' || true)"
  if [ -z "$url" ]; then
    url="$(pick_asset '\.deb$' || true)"
  fi
  if [ -z "$url" ]; then
    echo "❌  No Linux package found for ${APP_TAG}"
    echo "    https://github.com/${REPO}/releases/tag/${APP_TAG}"
    exit 1
  fi
  dest="${HOME}/DataExplorer-$(basename "$url" | sed 's/ /-/g')"
  echo "⬇️  Downloading…"
  curl -fL --progress-bar -o "$dest" "$url"
  if [[ "$dest" == *.AppImage ]]; then
    chmod +x "$dest"
    echo "🚀  Launching…"
    "$dest" &
  else
    echo "📦  Saved ${dest} — install with your package manager (e.g. sudo dpkg -i)."
  fi
  echo
  echo "✅  Done"
  echo
}

case "$(uname -s)" in
  Darwin) install_macos ;;
  Linux) install_linux ;;
  *)
    echo "❌  On Windows use:"
    echo "    irm https://github.com/${REPO}/releases/latest/download/install-desktop.ps1 | iex"
    exit 1
    ;;
esac
