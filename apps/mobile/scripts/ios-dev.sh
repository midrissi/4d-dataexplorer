#!/usr/bin/env bash
# Boot an iOS Simulator, wait until ready, then run `tauri ios:dev`.
# Avoids: simctl install → "Unable to lookup in current state: Shutdown" (code 149/405).
set -euo pipefail

DEVICE_NAME="${1:-${IOS_SIMULATOR:-iPhone 16 Pro Max}}"

udid="$(
  xcrun simctl list devices available \
    | awk -v name="$DEVICE_NAME" '
        index($0, name) && $0 ~ /\([0-9A-Fa-f-]{36}\)/ {
          if (match($0, /\([0-9A-Fa-f-]{36}\)/)) {
            print substr($0, RSTART + 1, RLENGTH - 2)
            exit
          }
        }
      '
)"

if [[ -z "${udid}" ]]; then
  echo "error: no available simulator named \"${DEVICE_NAME}\"" >&2
  echo "List with: xcrun simctl list devices available" >&2
  exit 1
fi

state="$(xcrun simctl list devices | awk -v id="$udid" 'index($0, id) { print; exit }')"
if [[ "$state" != *"(Booted)"* ]]; then
  echo "Booting simulator: ${DEVICE_NAME} (${udid})"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b
  open -a Simulator --args -CurrentDeviceUDID "$udid" 2>/dev/null || true
else
  echo "Simulator already booted: ${DEVICE_NAME} (${udid})"
fi

cd "$(dirname "$0")/.."
exec bunx tauri ios dev "$DEVICE_NAME"
