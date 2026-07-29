/**
 * Cross-platform binary download / share helpers.
 *
 * Web: `<a download>` for save; Web Share API for share when available.
 * Desktop/mobile Tauri: register a native save-dialog + writeFile via
 * {@link registerDownloadBytes}. Share still uses the browser share sheet when
 * the WebView exposes it.
 */

export type DownloadBytesInput = {
  /** Suggested filename including extension (e.g. `photo.png`). */
  filename: string
  bytes: Uint8Array
  mime?: string
}

export type DownloadBytesFn = (input: DownloadBytesInput) => Promise<void>

let _downloadBytes: DownloadBytesFn | null = null

/**
 * Register a native download implementation (called by the Tauri app).
 */
export function registerDownloadBytes(fn: DownloadBytesFn): void {
  _downloadBytes = fn
}

/** Copy into a standalone buffer — never pass a TypedArray's shared `.buffer` into Blob. */
function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

function toBlob({ bytes, mime }: DownloadBytesInput): Blob {
  return new Blob([copyBytes(bytes)], {
    type: mime ?? 'application/octet-stream',
  })
}

function toFile(input: DownloadBytesInput): File {
  const blob = toBlob(input)
  return new File([blob], input.filename, { type: blob.type })
}

function downloadBytesInBrowser(input: DownloadBytesInput): void {
  const blob = toBlob(input)
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = input.filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

/**
 * Whether the current environment can open a system share sheet for files.
 * Requires both `navigator.share` and `navigator.canShare({ files })` — presence
 * of `canShare` alone is not enough (some desktops expose a stub).
 */
export function canShareBytes(input: DownloadBytesInput): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return false
  if (typeof File === 'undefined') return false
  try {
    const file = toFile(input)
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

/** Cached probe: is file sharing available in this browser/WebView at all? */
let _canShareFiles: boolean | null = null

export function canShareFiles(): boolean {
  if (_canShareFiles !== null) return _canShareFiles
  _canShareFiles = canShareBytes({
    filename: 'probe.bin',
    bytes: new Uint8Array([0]),
    mime: 'application/octet-stream',
  })
  return _canShareFiles
}

/**
 * Open the system share sheet for the given bytes (AirDrop, Mail, Save to Files, etc.).
 * Throws if share is unavailable or the user cancels in a way that surfaces an error.
 *
 * Callers should preload bytes before the click handler when possible — iOS WKWebView
 * requires a transient user gesture and drops it across `await` boundaries.
 */
export async function shareBytes(input: DownloadBytesInput): Promise<void> {
  if (!canShareBytes(input)) {
    throw new Error('Sharing is not available in this browser')
  }
  const file = toFile(input)
  await navigator.share({ files: [file], title: input.filename })
}

/**
 * Save bytes to a user-chosen file. Uses the registered native handler when
 * available; otherwise triggers a browser download (not the share sheet).
 */
export async function downloadBytes(input: DownloadBytesInput): Promise<void> {
  if (_downloadBytes) {
    await _downloadBytes(input)
    return
  }
  downloadBytesInBrowser(input)
}
