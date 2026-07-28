#!/usr/bin/env bash
# Clear macOS quarantine attributes on Data Explorer.app (Gatekeeper / ad-hoc builds).
#
# Safe to run from Terminal after download. Preferred over double-clicking a
# quarantined .command file.
#
# Stamped by CI for each GitHub Release (version, tag, and download URL).
#
# Usage:
#   bash fix-macos-quarantine.sh
#   bash fix-macos-quarantine.sh "/path/to/Data Explorer.app"
#   curl -fsSL __FIX_SCRIPT_URL__ | bash
#
# Optional: pass --no-open to skip launching the app after clearing xattrs.
set -euo pipefail

APP_NAME="Data Explorer.app"
APP_VERSION="__APP_VERSION__"
APP_TAG="__APP_TAG__"
FIX_SCRIPT_URL="__FIX_SCRIPT_URL__"
DOCS_URL="https://midrissi.github.io/4d-dataexplorer/guide/macos-desktop"
NO_OPEN=0
APP_ARG=""

for arg in "$@"; do
  case "$arg" in
    --no-open) NO_OPEN=1 ;;
    -h|--help)
      cat <<EOF
Clear quarantine flags on Data Explorer.app so Gatekeeper allows launch.

Release: ${APP_TAG} (app ${APP_VERSION})

Usage:
  bash fix-macos-quarantine.sh [path-to-Data Explorer.app] [--no-open]

Examples:
  xattr -cr "/Applications/Data Explorer.app" && open "/Applications/Data Explorer.app"
  curl -fsSL ${FIX_SCRIPT_URL} | bash
EOF
      exit 0
      ;;
    *)
      if [ -z "$APP_ARG" ]; then
        APP_ARG="$arg"
      fi
      ;;
  esac
done

echo
echo "🛠  Data Explorer — macOS quarantine fix"
echo "────────────────────────────────────────"
echo "📦  Release: ${APP_TAG} (app ${APP_VERSION})"
echo

resolve_app() {
  local candidate="$1"
  if [ -z "$candidate" ]; then
    return 1
  fi
  # Allow passing the .app or its parent folder.
  if [ -d "$candidate" ] && [[ "$candidate" == *.app ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi
  if [ -d "$candidate/$APP_NAME" ]; then
    printf '%s\n' "$candidate/$APP_NAME"
    return 0
  fi
  return 1
}

find_app() {
  local found=""

  if found="$(resolve_app "${APP_ARG:-}")"; then
    printf '%s\n' "$found"
    return 0
  fi

  if [ -d "$PWD/$APP_NAME" ]; then
    printf '%s\n' "$PWD/$APP_NAME"
    return 0
  fi

  if [ -d "/Applications/$APP_NAME" ]; then
    printf '%s\n' "/Applications/$APP_NAME"
    return 0
  fi

  # Common unzip locations (shallow) — ignore errors / empty Downloads.
  if [ -d "$HOME/Downloads" ]; then
    found="$(find "$HOME/Downloads" -maxdepth 5 -type d -name "$APP_NAME" 2>/dev/null | head -n 1 || true)"
    if [ -n "$found" ]; then
      printf '%s\n' "$found"
      return 0
    fi
  fi

  if [ -d "$HOME/Desktop" ]; then
    found="$(find "$HOME/Desktop" -maxdepth 4 -type d -name "$APP_NAME" 2>/dev/null | head -n 1 || true)"
    if [ -n "$found" ]; then
      printf '%s\n' "$found"
      return 0
    fi
  fi

  return 1
}

if ! APP_PATH="$(find_app)"; then
  echo "❌  Could not find \"$APP_NAME\"."
  echo
  echo "💡  Do one of the following, then re-run:"
  echo "    1. cd into the unzipped folder that contains the app, or"
  echo "    2. Move the app to /Applications, or"
  echo "    3. Pass the path explicitly:"
  echo "       bash fix-macos-quarantine.sh \"/path/to/Data Explorer.app\""
  echo
  echo "📖  Guide: open README.html from the ZIP, or $DOCS_URL"
  echo "⬇️  This release’s script: $FIX_SCRIPT_URL"
  echo
  exit 1
fi

echo "🔎  Found app at:"
echo "    $APP_PATH"
echo
echo "🧹  Clearing quarantine attributes (xattr -cr)…"
xattr -cr "$APP_PATH"
echo
echo "✅  Quarantine attributes cleared."

if [ "$NO_OPEN" -eq 0 ]; then
  echo "🚀  Opening Data Explorer…"
  open "$APP_PATH"
  echo
  echo "✅  Done."
else
  echo
  echo "✅  Done. Open the app from Finder when ready."
fi

echo
echo "💡  Tip: drag Data Explorer.app to /Applications for a permanent install."
echo "📖  Docs: $DOCS_URL"
echo
