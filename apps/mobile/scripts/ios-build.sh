#!/usr/bin/env bash
# Reliable `tauri ios build` wrapper (simulator by default).
#
# Fixes archive-time "failed to build WebSocket client / Connection refused"
# by pinning TMPDIR for parent + Xcode script and routing the Build Rust Code
# phase through scripts/ios-xcode-script.sh (stable PATH + cwd).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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

chmod +x "$ROOT/scripts/ios-xcode-script.sh"

XCODE_HELPER="$ROOT/scripts/ios-xcode-script.sh"
SCRIPT_LINE="${XCODE_HELPER} -v --platform \${PLATFORM_DISPLAY_NAME:?} --sdk-root \${SDKROOT:?} --framework-search-paths \"\${FRAMEWORK_SEARCH_PATHS:?}\" --header-search-paths \"\${HEADER_SEARCH_PATHS:?}\" --gcc-preprocessor-definitions \"\${GCC_PREPROCESSOR_DEFINITIONS:-}\" --configuration \${CONFIGURATION:?} \${FORCE_COLOR} \${ARCHS:?}"

python3 - "$GEN_APPLE" "$SCRIPT_LINE" "$TMPDIR" <<'PY'
import pathlib, re, sys

gen = pathlib.Path(sys.argv[1])
script_line = sys.argv[2]
tmpdir = sys.argv[3]

project_yml = gen / "project.yml"
pbxproj = next(gen.glob("*.xcodeproj/project.pbxproj"))

# Ensure TAURI_IOS_TMPDIR is available inside the Xcode script phase.
wrapped = (
    f'export TAURI_IOS_TMPDIR="{tmpdir}"; '
    f'export TMPDIR="{tmpdir}"; '
    f"{script_line}"
)

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

echo "TMPDIR=$TMPDIR"
echo "TAURI_IOS_TMPDIR=$TAURI_IOS_TMPDIR"
echo "Running: bunx tauri ios build ${ARGS[*]}"
exec bunx tauri ios build "${ARGS[@]}"
