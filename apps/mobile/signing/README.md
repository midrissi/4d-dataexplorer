# 🔐 Mobile release signing (Android + iOS)

How to generate keys, store them as **GitHub Actions secrets**, and produce
installable APKs / device IPAs for Data Explorer Mobile.

📎 Bundle ID / application id: `com.fourd.dataexplorer.mobile`  
(`apps/mobile/src-tauri/tauri.conf.json` → `identifier`)

✨ Helper script (preferred):

```bash
cd apps/mobile
bash scripts/generate-mobile-signing.sh --help
bash scripts/generate-mobile-signing.sh secrets-list
```

---

## 🚦 What CI does today

| Platform | Workflow | Signed? | Artifact |
| --- | --- | --- | --- |
| 🤖 Android | `.github/workflows/mobile.yml` | ✅ Yes | `Data-Explorer_<ver>_android-aarch64.apk` on the GitHub Release |
| 🍎 iOS | same workflow | ❌ No (simulator only) | `Data-Explorer_<ver>_ios-sim-release.zip` |

Android signing is applied by `scripts/patch-android-signing.sh` during
`android-prepare.sh`:

1. If `ANDROID_KEY_BASE64` + `ANDROID_KEY_ALIAS` + `ANDROID_KEY_PASSWORD` are set → private upload keystore
2. Else → committed public sideload keystore [`sideload.p12`](./sideload.p12)

⚠️ Unsigned Android release APKs fail on device with **App not installed**.

---

## 🤖 Android

### Option A — GitHub sideload (default, public key)

APKs on GitHub Releases are signed with the committed keystore so anyone can
install them without Play App Signing.

| Field | Value |
| --- | --- |
| File | [`sideload.p12`](./sideload.p12) (PKCS12) |
| Alias | `sideload` |
| Password | `dataexplorer-sideload` |

⚠️ This key is **public**. Do **not** upload apps signed with it to Play Console.

Regenerate (breaks in-place upgrades from older sideload builds):

```bash
cd apps/mobile
bash scripts/generate-mobile-signing.sh android --sideload --force
git add signing/sideload.p12
```

### Option B — Private upload key (Play / closed distribution)

```bash
cd apps/mobile
bash scripts/generate-mobile-signing.sh android
# or non-interactive:
bash scripts/generate-mobile-signing.sh android --password 'choose-a-strong-password'
# optional: push straight to the repo secrets
bash scripts/generate-mobile-signing.sh android --password '…' --gh
```

The script writes (gitignored under `signing/private/`):

- `upload-YYYYMMDD.p12` — keystore
- `upload-YYYYMMDD.env` — alias + password reminder
- `github-secrets-android-YYYYMMDD.md` — **report of every GitHub secret to set** (names, values, checklist, `gh` commands)

Then add repository secrets (Settings → Secrets and variables → Actions), paste from the report, or use `--gh`:

| Secret | Contents |
| --- | --- |
| `ANDROID_KEY_BASE64` | `base64` of the `.p12` (script prints this) |
| `ANDROID_KEY_ALIAS` | e.g. `upload` |
| `ANDROID_KEY_PASSWORD` | keystore password |

`mobile.yml` already forwards these into `android-prepare`. After the next green
`main` mobile upload, release APKs use the private key.

💻 **Local release build with the same key:**

```bash
export ANDROID_KEY_BASE64="$(base64 -i signing/private/upload-YYYYMMDD.p12 | tr -d '\n')"
export ANDROID_KEY_ALIAS=upload
export ANDROID_KEY_PASSWORD='…'
cd apps/mobile && bun run tauri:android:build
```

### 📱 Install tips

- First install after switching keys: **uninstall** the old Data Explorer build
  (signature mismatch → “App not installed”).
- Enable “Install unknown apps” for the browser / Files app used to open the APK.
- Architecture: CI ships **aarch64** only (typical phones). Emulators may need a
  different ABI build.

📚 Official Tauri reference: [Android code signing](https://v2.tauri.app/distribute/sign/android/).

---

## 🍎 iOS

Apple does **not** let you invent signing keys offline. You create a certificate
+ provisioning profile in the Apple Developer portal (paid program), export them,
then encode for CI / Tauri.

### ✅ Checklist + encode

```bash
cd apps/mobile
bash scripts/generate-mobile-signing.sh ios checklist
bash scripts/generate-mobile-signing.sh ios encode \
  --cert ~/Downloads/Distribution.p12 \
  --profile ~/Downloads/DataExplorer_AppStore.mobileprovision \
  --password 'p12-export-password' \
  [--gh]
```

Prints a **GitHub secrets report** (and writes `signing/private/github-secrets-ios-YYYYMMDD.md`) with every `IOS_*` secret to set.

### 🔐 GitHub secrets (manual signing)

| Secret | Contents |
| --- | --- |
| `IOS_CERTIFICATE` | `base64` of the Keychain-exported `.p12` |
| `IOS_CERTIFICATE_PASSWORD` | password chosen when exporting the `.p12` |
| `IOS_MOBILE_PROVISION` | `base64` of the `.mobileprovision` |

Tauri reads these env vars during `tauri ios build` for device / IPA export
([iOS code signing](https://v2.tauri.app/distribute/sign/ios/)).

**Certificate type by goal**

| Goal | Certificate | Profile |
| --- | --- | --- |
| TestFlight / App Store | Apple Distribution | App Store Connect |
| Ad hoc device list | Apple Distribution | Ad Hoc |
| Dev cable install | Apple Development | Development |

📎 Bundle ID must match `com.fourd.dataexplorer.mobile`.

### 📱 Local signed device IPA

```bash
export IOS_CERTIFICATE=…
export IOS_CERTIFICATE_PASSWORD=…
export IOS_MOBILE_PROVISION=…
cd apps/mobile
bun run tauri:ios:build:device
```

Or use Xcode automatic signing on a Mac (`tauri:ios:build:device` with an Apple
ID configured in Xcode).

### 🤖 Automatic signing (API key)

For CI automatic signing, create an App Store Connect API key and set:

- `APPLE_API_ISSUER`
- `APPLE_API_KEY`
- `APPLE_API_KEY_PATH` (path to the `.p8` on the runner)

See [Tauri iOS automatic signing](https://v2.tauri.app/distribute/sign/ios/#automatic-signing).

### 🚦 CI status

The Mobile workflow currently builds an **unsigned simulator** `.app` (no Apple
secrets required). Wiring a signed IPA job means adding the secrets above and a
`macos-latest` step that exports `IOS_*` (or the API key vars) before
`bun run tauri:ios:build:device`. Until then, use a local Mac for device/TestFlight
builds.

---

## 📋 Secret inventory

```bash
bash scripts/generate-mobile-signing.sh secrets-list
```

| Secret | Platform | Required for |
| --- | --- | --- |
| `ANDROID_KEY_BASE64` | 🤖 Android | Private / Play upload signing |
| `ANDROID_KEY_ALIAS` | 🤖 Android | Private / Play upload signing |
| `ANDROID_KEY_PASSWORD` | 🤖 Android | Private / Play upload signing |
| `IOS_CERTIFICATE` | 🍎 iOS | Manual device / IPA signing |
| `IOS_CERTIFICATE_PASSWORD` | 🍎 iOS | Manual device / IPA signing |
| `IOS_MOBILE_PROVISION` | 🍎 iOS | Manual device / IPA signing |
| `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` | 🍎 iOS | Automatic Xcode signing in CI |

🚫 Never commit files under `signing/private/`.
