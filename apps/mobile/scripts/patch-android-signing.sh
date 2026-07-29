#!/usr/bin/env bash
# Configure release APK signing for the generated Android project.
# Android signing is applied by `scripts/patch-android-signing.sh` (see
# signing/README.md). Prefer ANDROID_KEY_* secrets; else committed sideload.p12.
#
# Safe to re-run after `tauri android init` (gen/ is gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GEN_ANDROID="$ROOT/src-tauri/gen/android"
GRADLE="$GEN_ANDROID/app/build.gradle.kts"
PROPS="$GEN_ANDROID/keystore.properties"
SIDELOAD_STORE="$ROOT/signing/sideload.p12"
MARKER='// dataexplorer-android-signing'

if [[ ! -f "$GRADLE" ]]; then
  echo "skip Android signing patch: $GRADLE missing (run tauri android init first)" >&2
  exit 0
fi

if [[ ! -f "$PROPS" ]]; then
  if [[ -n "${ANDROID_KEY_BASE64:-}" && -n "${ANDROID_KEY_ALIAS:-}" && -n "${ANDROID_KEY_PASSWORD:-}" ]]; then
    STORE_PATH="${RUNNER_TEMP:-/tmp}/dataexplorer-android-upload.p12"
    # Support either .p12 or .jks bytes in the secret.
    echo "$ANDROID_KEY_BASE64" | base64 --decode >"$STORE_PATH"
    cat >"$PROPS" <<EOF
password=${ANDROID_KEY_PASSWORD}
keyAlias=${ANDROID_KEY_ALIAS}
storeFile=${STORE_PATH}
EOF
    echo "wrote $PROPS from ANDROID_KEY_* secrets"
  elif [[ -f "$SIDELOAD_STORE" ]]; then
    cat >"$PROPS" <<EOF
password=dataexplorer-sideload
keyAlias=sideload
storeFile=${SIDELOAD_STORE}
EOF
    echo "wrote $PROPS using committed sideload keystore"
  else
    echo "warning: no keystore.properties and no sideload.p12 — release APK may be unsigned" >&2
  fi
fi

if grep -qF "$MARKER" "$GRADLE"; then
  echo "Android signing already patched in build.gradle.kts"
  exit 0
fi

python3 - "$GRADLE" "$MARKER" <<'PY'
from pathlib import Path
import sys

gradle = Path(sys.argv[1])
marker = sys.argv[2]
text = gradle.read_text()

if marker in text:
    print("already patched")
    raise SystemExit(0)

# Ensure imports used by the signing block.
if "import java.util.Properties" not in text:
    text = "import java.util.Properties\n" + text
if "import java.io.FileInputStream" not in text:
    # Place after the first import block line for readability.
    lines = text.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, "import java.io.FileInputStream\n")
    text = "".join(lines)

signing_block = f"""
{marker}
signingConfigs {{
    create("release") {{
        val keystorePropertiesFile = rootProject.file("keystore.properties")
        if (keystorePropertiesFile.exists()) {{
            val keystoreProperties = Properties()
            keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["password"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
        }} else {{
            // Last-resort local installs when prepare did not write keystore.properties.
            initWith(getByName("debug"))
        }}
    }}
}}
"""

needle = "    buildTypes {"
if needle not in text:
    raise SystemExit(f"error: could not find buildTypes block in {gradle}")

text = text.replace(needle, signing_block + "\n" + needle, 1)

release_needle = '        getByName("release") {'
if release_needle not in text:
    raise SystemExit(f"error: could not find release buildType in {gradle}")

# Inject signingConfig as the first line inside the release block (once).
replacement = (
    '        getByName("release") {\n'
    '            signingConfig = signingConfigs.getByName("release")'
)
# Avoid double-inject if somehow partial.
if "signingConfig = signingConfigs.getByName(\"release\")" not in text:
    text = text.replace(release_needle, replacement, 1)

gradle.write_text(text)
print(f"patched release signing into {gradle}")
PY
