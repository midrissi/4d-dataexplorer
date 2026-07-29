#!/usr/bin/env bash
# Shared setup for `tauri ios build|dev` so the Xcode "Build Rust Code" phase
# can reach the CLI options WebSocket (same TMPDIR + cwd via ios-xcode-script.sh).
#
# Usage (from apps/mobile):
#   source "$(dirname "$0")/ios-prepare-xcode.sh"
# Exports: TMPDIR, TAURI_IOS_TMPDIR, ROOT, GEN_APPLE
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export TMPDIR="${TAURI_IOS_TMPDIR:-/tmp/tauri-ios-build}"
mkdir -p "$TMPDIR"
export TAURI_IOS_TMPDIR="$TMPDIR"
export PATH="${HOME}/.bun/bin:${HOME}/.cargo/bin:${PATH}"

IDENTIFIER="$(
  node -e "console.log(JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')).identifier)"
)"
rm -f "$TMPDIR/${IDENTIFIER}-server-addr"

GEN_APPLE="$ROOT/src-tauri/gen/apple"
if [[ ! -d "$GEN_APPLE" ]]; then
  echo "Initializing iOS project…"
  bunx tauri ios init --ci --skip-targets-install
fi

# Keep Xcode AppIcon in sync with icons/ios (matches desktop). `tauri ios init`
# can seed Assets.xcassets with a stale brand mark that does not match icon.png.
ICON_SRC="$ROOT/src-tauri/icons/ios"
ICON_DST="$GEN_APPLE/Assets.xcassets/AppIcon.appiconset"
if [[ -d "$ICON_SRC" && -d "$ICON_DST" ]]; then
  cp -f "$ICON_SRC"/*.png "$ICON_DST/"
  echo "synced AppIcon from icons/ios → Assets.xcassets"
fi

# Branded launch screen (#12141c + logo). Re-applied after every prepare /
# ios init because gen/ is gitignored.
bash "$ROOT/scripts/patch-mobile-splash.sh"

IOS_DISPLAY_NAME="Data Explorer"
python3 - "$GEN_APPLE" "$IOS_DISPLAY_NAME" <<'PY'
import pathlib, re, sys

gen = pathlib.Path(sys.argv[1])
display = sys.argv[2]

plist = next(gen.glob("*_iOS/Info.plist"))
text = plist.read_text()
if "CFBundleDisplayName" in text:
    text2, n = re.subn(
        r"(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)",
        rf"\g<1>{display}\2",
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"failed to update CFBundleDisplayName in {plist}")
else:
    # Insert after CFBundleName block (or after identifier if name missing).
    anchor = "</string>\n\t<key>CFBundlePackageType</key>"
    if "<key>CFBundleName</key>" in text and anchor in text:
        text2 = text.replace(
            anchor,
            f"</string>\n\t<key>CFBundleDisplayName</key>\n\t<string>{display}</string>\n\t<key>CFBundlePackageType</key>",
            1,
        )
    else:
        raise SystemExit(f"could not insert CFBundleDisplayName into {plist}")
plist.write_text(text2)
print(f"set CFBundleDisplayName={display!r} in {plist}")

yml_path = gen / "project.yml"
yml = yml_path.read_text()
if "CFBundleDisplayName:" in yml:
    yml2, n = re.subn(
        r"CFBundleDisplayName:\s*.*",
        f"CFBundleDisplayName: {display}",
        yml,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"failed to update CFBundleDisplayName in {yml_path}")
else:
    yml2, n = re.subn(
        r"(properties:\n(?:        .+\n)*?)(        CFBundleShortVersionString:)",
        rf"\1        CFBundleDisplayName: {display}\n\2",
        yml,
        count=1,
    )
    if n != 1:
        # Fallback: insert right after UILaunchStoryboardName
        yml2, n = re.subn(
            r"(UILaunchStoryboardName: LaunchScreen\n)",
            rf"\1        CFBundleDisplayName: {display}\n",
            yml,
            count=1,
        )
    if n != 1:
        raise SystemExit(f"failed to insert CFBundleDisplayName into {yml_path}")
yml_path.write_text(yml2)
print(f"set CFBundleDisplayName={display!r} in {yml_path}")
PY

chmod +x "$ROOT/scripts/ios-xcode-script.sh"

XCODE_HELPER="$ROOT/scripts/ios-xcode-script.sh"
SCRIPT_LINE="${XCODE_HELPER} -v --platform \${PLATFORM_DISPLAY_NAME:?} --sdk-root \${SDKROOT:?} --framework-search-paths \"\${FRAMEWORK_SEARCH_PATHS:?}\" --header-search-paths \"\${HEADER_SEARCH_PATHS:?}\" --gcc-preprocessor-definitions \"\${GCC_PREPROCESSOR_DEFINITIONS:-}\" --configuration \${CONFIGURATION:?} \${FORCE_COLOR} \${ARCHS:?}"

python3 - "$GEN_APPLE" "$SCRIPT_LINE" "$TMPDIR" <<'PY'
import pathlib, re, sys

gen = pathlib.Path(sys.argv[1])
script_line = sys.argv[2]
tmpdir = sys.argv[3]

# Ensure TAURI_IOS_TMPDIR is available inside the Xcode script phase.
wrapped = (
    f'export TAURI_IOS_TMPDIR="{tmpdir}"; '
    f'export TMPDIR="{tmpdir}"; '
    f"{script_line}"
)

project_yml = gen / "project.yml"
pbxproj = next(gen.glob("*.xcodeproj/project.pbxproj"))

yml = project_yml.read_text()
yml2, n = re.subn(
    r"(- script: ).*(?:tauri ios xcode-script|ios-xcode-script\.sh).*",
    r"\1" + wrapped,
    yml,
    count=1,
)
if n != 1:
    raise SystemExit(f"failed to patch {project_yml} (matches={n})")
project_yml.write_text(yml2)
print(f"patched {project_yml}")

escaped = wrapped.replace("\\", "\\\\").replace('"', '\\"')
pbx = pbxproj.read_text()
pbx2, n = re.subn(
    r'shellScript = ".*?(?:tauri ios xcode-script|ios-xcode-script\.sh).*?";',
    f'shellScript = "{escaped}";',
    pbx,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"failed to patch {pbxproj} (matches={n})")
pbxproj.write_text(pbx2)
print(f"patched {pbxproj}")
PY

echo "TMPDIR=$TMPDIR"
echo "TAURI_IOS_TMPDIR=$TAURI_IOS_TMPDIR"
