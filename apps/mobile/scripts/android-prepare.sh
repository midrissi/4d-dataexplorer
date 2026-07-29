#!/usr/bin/env bash
# Keep generated Android project icons + label in sync with src-tauri branding.
# Safe to re-run after `tauri android init` (gen/ is gitignored).
#
# Usage (from apps/mobile):
#   bash ./scripts/android-prepare.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GEN_ANDROID="$ROOT/src-tauri/gen/android"
ICON_SRC="$ROOT/src-tauri/icons/android"

if [[ ! -d "$GEN_ANDROID" ]]; then
  echo "Initializing Android project…"
  bunx tauri android init --ci --skip-targets-install
fi

RES="$GEN_ANDROID/app/src/main/res"
if [[ -d "$ICON_SRC" && -d "$RES" ]]; then
  for density in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi mipmap-anydpi-v26; do
    if [[ -d "$ICON_SRC/$density" ]]; then
      mkdir -p "$RES/$density"
      cp -f "$ICON_SRC/$density"/* "$RES/$density/"
    fi
  done
  if [[ -f "$ICON_SRC/values/ic_launcher_background.xml" ]]; then
    mkdir -p "$RES/values"
    cp -f "$ICON_SRC/values/ic_launcher_background.xml" "$RES/values/"
  fi
  echo "synced Android launcher icons from icons/android → gen/android"
else
  echo "skip Android icon sync: missing $ICON_SRC or $RES" >&2
fi

PRODUCT_NAME="$(
  node -e "const c=JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')); process.stdout.write(c.productName || 'Data Explorer')"
)"

python3 - "$GEN_ANDROID" "$PRODUCT_NAME" <<'PY'
import pathlib, re, sys

gen = pathlib.Path(sys.argv[1])
name = sys.argv[2]
updated = 0

for strings in gen.rglob("strings.xml"):
    text = strings.read_text()
    text2, n = re.subn(
        r'(<string name="app_name">)[^<]*(</string>)',
        rf"\g<1>{name}\2",
        text,
        count=1,
    )
    if n:
        strings.write_text(text2)
        updated += 1
        print(f"set app_name={name!r} in {strings}")

if updated == 0:
    print(f"warning: no app_name string found under {gen}", file=sys.stderr)
PY

bash "$ROOT/scripts/patch-mobile-splash.sh"
bash "$ROOT/scripts/patch-android-signing.sh"
