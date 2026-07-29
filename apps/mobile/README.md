# Data Explorer Mobile

Tauri 2 shell for **iOS** and **Android**. Reuses `@4d/dataexplorer` with a mobile connection screen, CORS-free native HTTP (same as desktop), and a **Beta** badge. Schema graph and JSON Schema Builder are omitted in this first version.

## Prerequisites

- [Bun](https://bun.sh) 1.3.9+
- Rust toolchain (same as desktop Tauri)
- [Tauri mobile prerequisites](https://v2.tauri.app/start/prerequisites/)
  - **Android:** Android Studio, SDK, NDK, emulator or device
  - **iOS:** macOS, Xcode, CocoaPods, simulator or device

From the monorepo root:

```bash
bun install --frozen-lockfile
```

## Develop (WebView UI only)

Useful to iterate on the React UI without a device:

```bash
bun --filter @4d/mobile dev
```

Open http://localhost:3005 — REST calls fall back to browser `fetch` outside Tauri (CORS may apply). Full LAN/internet connectivity without CORS requires a Tauri run below.

## Android

```bash
cd apps/mobile
bun run tauri:android:dev    # first run may prompt `tauri android init`
bun run tauri:android:build
```

### Local network (LAN) REST servers

Phones and tablets cannot use `localhost` to reach a server on your computer. Enter the machine’s LAN IP, for example `http://192.168.1.10:7080`.

**Cleartext HTTP:** Android blocks cleartext by default. After `tauri android init`, ensure the generated Android app allows cleartext (e.g. `android:usesCleartextTraffic="true"` on the application tag, or a network security config that permits your LAN). HTTPS with skip-SSL (self-signed lab hosts) uses the same Rust helper as desktop.

## iOS

```bash
cd apps/mobile
bun run tauri:ios:dev                 # boots simulator first (default: iPhone 16 Pro Max)
bun run tauri:ios:dev -- "iPhone 16"  # or pass another simulator name
bun run tauri:ios:build               # simulator (aarch64-sim) via scripts/ios-build.sh
bun run tauri:ios:build:device        # physical device / IPA
```

`tauri:ios:dev` and `tauri:ios:build` wrap the Tauri CLI so the Xcode “Build Rust Code” phase can reach the CLI options WebSocket (pins `TMPDIR`, runs the script from `gen/apple`). Without that, builds often fail with `Connection refused` / wrong app identifier in this monorepo. They also re-sync `icons/ios` into `Assets.xcassets/AppIcon` so the home-screen icon matches desktop (orange database mark), and apply the branded splash (`#12141c` + logo) via `scripts/patch-mobile-splash.sh`. The home-screen label is `Data Explorer` (`CFBundleDisplayName` / `productName`).

`tauri:android:dev` / `tauri:android:build` run `scripts/android-prepare.sh` first: sync launcher mipmaps + `app_name` from `icons/android` / `tauri.conf.json`, then patch splash, then invoke Tauri. After a brand change, uninstall the old APK once so Android refreshes the cached launcher icon.

If deploy fails with `Unable to lookup in current state: Shutdown` / `simctl install` exit 149, the chosen simulator was not booted. `tauri:ios:dev` boots and waits before install. You can also boot manually:

```bash
xcrun simctl boot "iPhone 16 Pro Max"
open -a Simulator
```

`tauri ios build` defaults to a **device** (`iphoneos`) destination. If Xcode reports *Found no destinations* / *iOS … is not installed*, either:

1. Use the simulator build (`bun run tauri:ios:build`), or
2. Install the matching iOS **device** platform in **Xcode → Settings → Platforms** (Components), connect a device or use automatic signing, then run `bun run tauri:ios:build:device`.

For plain HTTP to a LAN host, App Transport Security may need exceptions in the generated Xcode project (or use HTTPS + skip SSL for self-signed lab servers).

## Themes

Same as desktop/web: light/dark mode plus color themes Slate, Tangerine, Violet Bloom, Vercel, Graphite, Aurora (connection screen footer and Settings).

## CI

Mobile builds run inside the main [CI](../../.github/workflows/ci.yml) pipeline **after** Lint & Check, Unit Tests, Build, and E2E are green (reusable workflow [`.github/workflows/mobile.yml`](../../.github/workflows/mobile.yml)):

| Job | Runner | When | Output |
| --- | --- | --- | --- |
| Build Android | `ubuntu-latest` | After E2E | Debug APK (`aarch64`) artifact `mobile-android-apk` |
| Build iOS | `macos-latest` | After E2E | Simulator debug build artifact `mobile-ios-sim` |
| Upload mobile to release | `ubuntu-latest` | Push to **`main`** only | APK + iOS zip on the SHA-stamped GitHub Release |

You can also run the Mobile workflow manually via `workflow_dispatch` (build only; no release upload).

Generated `src-tauri/gen/` projects are created in CI via `tauri android|ios init --ci`. Store signing / App Store export is not configured yet — local device / release IPA builds still use `tauri:ios:build:device` with Xcode signing.

## Architecture notes

- `VITE_APP_SHELL=mobile` selects mobile chrome and feature gates.
- Native HTTP: `@tauri-apps/plugin-http` + `desktop_http_request` (skip SSL), shared TypeScript host libs from `@4d/desktop` via Vite aliases.
- Connection profiles: `@tauri-apps/plugin-store` → `connections.json`.
