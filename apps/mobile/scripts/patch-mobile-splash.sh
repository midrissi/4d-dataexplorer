#!/usr/bin/env bash
# Apply branded splash (#12141c + logo) to generated iOS / Android projects.
# Safe to re-run after `tauri ios|android init` (gen/ is gitignored).
#
# Usage (from apps/mobile):
#   bash ./scripts/patch-mobile-splash.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPLASH_SRC="$ROOT/src-tauri/splash"
GEN_APPLE="$ROOT/src-tauri/gen/apple"
GEN_ANDROID="$ROOT/src-tauri/gen/android"

# App shell background — keep in sync with tauri.conf.json / index.html
SPLASH_BG="#12141c"

patch_ios() {
  if [[ ! -d "$GEN_APPLE" ]]; then
    echo "skip iOS splash: $GEN_APPLE missing (run tauri ios init first)"
    return 0
  fi

  if [[ ! -f "$SPLASH_SRC/LaunchScreen.storyboard" ]]; then
    echo "error: missing $SPLASH_SRC/LaunchScreen.storyboard" >&2
    exit 1
  fi

  cp -f "$SPLASH_SRC/LaunchScreen.storyboard" "$GEN_APPLE/LaunchScreen.storyboard"

  local assets="$GEN_APPLE/Assets.xcassets"
  mkdir -p "$assets"
  rm -rf "$assets/SplashLogo.imageset"
  cp -R "$SPLASH_SRC/SplashLogo.imageset" "$assets/SplashLogo.imageset"

  # Ensure storyboard is listed as a resource in project.yml (Tauri template already does).
  if [[ -f "$GEN_APPLE/project.yml" ]] && ! grep -q 'LaunchScreen.storyboard' "$GEN_APPLE/project.yml"; then
    echo "warning: LaunchScreen.storyboard not referenced in project.yml" >&2
  fi

  echo "patched iOS LaunchScreen → $SPLASH_BG + SplashLogo"
}

patch_android() {
  if [[ ! -d "$GEN_ANDROID" ]]; then
    echo "skip Android splash: $GEN_ANDROID missing (run tauri android init first)"
    return 0
  fi

  local res="$GEN_ANDROID/app/src/main/res"
  local values="$res/values"
  local values_night="$res/values-night"
  local drawable="$res/drawable"
  mkdir -p "$values" "$values_night" "$drawable"

  # Brand colors
  cat >"$values/splash_colors.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_background">${SPLASH_BG}</color>
</resources>
EOF

  # Solid splash background (pre-Android 12 / post-splash window).
  cat >"$drawable/splash_screen.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
</layer-list>
EOF

  # Prefer Splash Screen API theme when available; fall back to windowBackground.
  # Tauri templates name the app theme Theme.<Package>; detect the style name.
  local themes="$values/themes.xml"
  local themes_night="$values_night/themes.xml"
  local style_name="Theme.Dataexplorer_mobile"
  if [[ -f "$themes" ]]; then
    local detected
    detected="$(
      python3 - "$themes" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r'<style\s+name="([^"]+)"', text)
print(m.group(1) if m else "")
PY
    )"
    if [[ -n "$detected" ]]; then
      style_name="$detected"
    fi
  fi

  local app_style="${style_name}.App"

  # Also honor the theme name referenced by AndroidManifest if present.
  local manifest="$GEN_ANDROID/app/src/main/AndroidManifest.xml"
  if [[ -f "$manifest" ]]; then
    local manifest_theme
    manifest_theme="$(
      python3 - "$manifest" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r'android:theme="@style/([^"]+)"', text)
print(m.group(1) if m else "")
PY
    )"
    if [[ -n "$manifest_theme" ]]; then
      style_name="$manifest_theme"
      app_style="${style_name}.App"
    fi
  fi

  cat >"$themes" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="${style_name}" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/${app_style}</item>
        <item name="android:windowSplashScreenBehavior" tools:targetApi="33">icon_preferred</item>
    </style>
    <style name="${app_style}" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowBackground">@drawable/splash_screen</item>
    </style>
</resources>
EOF

  cat >"$themes_night" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="${style_name}" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/${app_style}</item>
        <item name="android:windowSplashScreenBehavior" tools:targetApi="33">icon_preferred</item>
    </style>
    <style name="${app_style}" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowBackground">@drawable/splash_screen</item>
    </style>
</resources>
EOF

  # Ensure MainActivity installs the splash screen API (idempotent).
  local main_kt
  main_kt="$(find "$GEN_ANDROID/app/src/main/java" -name 'MainActivity.kt' 2>/dev/null | head -1 || true)"
  if [[ -n "$main_kt" ]]; then
    python3 - "$main_kt" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
changed = False
if "androidx.core.splashscreen.SplashScreen" not in text and "installSplashScreen" not in text:
    # Add import after package / existing imports
    if "import android.os.Bundle" in text and "splashscreen.SplashScreen" not in text:
        text = text.replace(
            "import android.os.Bundle",
            "import android.os.Bundle\nimport androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen",
            1,
        )
        changed = True
    if "override fun onCreate" in text and "installSplashScreen()" not in text:
        text = text.replace(
            "override fun onCreate(savedInstanceState: Bundle?) {",
            "override fun onCreate(savedInstanceState: Bundle?) {\n        installSplashScreen()",
            1,
        )
        changed = True
if changed:
    path.write_text(text)
    print(f"patched {path}")
else:
    print(f"MainActivity splash already patched or unexpected layout: {path}")
PY
  fi

  # Ensure dependency on splashscreen library in app build.gradle(.kts)
  local gradle
  if [[ -f "$GEN_ANDROID/app/build.gradle.kts" ]]; then
    gradle="$GEN_ANDROID/app/build.gradle.kts"
  elif [[ -f "$GEN_ANDROID/app/build.gradle" ]]; then
    gradle="$GEN_ANDROID/app/build.gradle"
  else
    gradle=""
  fi
  if [[ -n "$gradle" ]] && ! grep -q 'core-splashscreen' "$gradle"; then
    python3 - "$gradle" <<'PY'
import pathlib, sys, re
path = pathlib.Path(sys.argv[1])
text = path.read_text()
dep = '    implementation("androidx.core:core-splashscreen:1.0.1")\n'
if "dependencies" in text and "core-splashscreen" not in text:
    text2, n = re.subn(
        r"(dependencies\s*\{)",
        r"\1\n" + dep.rstrip("\n"),
        text,
        count=1,
    )
    if n:
        path.write_text(text2)
        print(f"added core-splashscreen to {path}")
PY
  fi

  echo "patched Android splash → $SPLASH_BG + launcher foreground"
}

patch_ios
patch_android
