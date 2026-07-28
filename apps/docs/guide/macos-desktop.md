---
title: macOS desktop first launch
---

# macOS desktop first launch

Desktop builds from GitHub Releases are **ad-hoc signed** but **not Apple-notarized**. After download, macOS Gatekeeper may say the app *can’t be opened* or is *damaged*.

Clear the quarantine attribute, then open the app. Prefer **Terminal** (commands you paste are not blocked the same way as double-clicking a downloaded helper script).

## Quarantine fix script (per release)

Each GitHub Release publishes its own `fix-macos-quarantine.sh` (stamped with that version). The same file is inside the macOS ZIP. Use the script that matches the app you downloaded — not an older or newer release’s copy.

<MacosQuarantineScript />

### Run with curl (this / latest release)

```bash
curl -fsSL https://github.com/midrissi/4d-dataexplorer/releases/latest/download/fix-macos-quarantine.sh | bash
```

For a specific tag (example `v1.2.3`):

```bash
curl -fsSL https://github.com/midrissi/4d-dataexplorer/releases/download/v1.2.3/fix-macos-quarantine.sh | bash
```

The script looks for `Data Explorer.app` in the current folder, `/Applications`, `~/Downloads`, and `~/Desktop`, then runs `xattr -cr` and opens the app.

### Run xattr yourself

If the app is already in Applications:

```bash
xattr -cr "/Applications/Data Explorer.app" && open "/Applications/Data Explorer.app"
```

If it is still in the unzipped folder — type `cd` then a space, drag the folder into Terminal, press Return, then:

```bash
xattr -cr "Data Explorer.app" && open "Data Explorer.app"
```

## ZIP contents

Each macOS desktop ZIP from CI includes:

- `Data Explorer.app` — the application
- `README.html` — offline guide (URLs stamped for that release)
- `fix-macos-quarantine.sh` — the same per-version script (run via `bash`, not double-click)

## Related links

- [GitHub Releases](https://github.com/midrissi/4d-dataexplorer/releases)
- [Getting started](/guide/getting-started) (web / Docker install)
- Template source: [`apps/desktop/scripts/fix-macos-quarantine.sh`](https://github.com/midrissi/4d-dataexplorer/blob/main/apps/desktop/scripts/fix-macos-quarantine.sh)
