/**
 * Cross-platform binary download helper.
 *
 * Web: triggers a browser download via a temporary object URL.
 * Desktop: the Tauri app registers a save-dialog + writeFile implementation
 * via {@link registerDownloadBytes}.
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
 * Register a desktop-native download implementation (called by the Tauri app).
 */
export function registerDownloadBytes(fn: DownloadBytesFn): void {
  _downloadBytes = fn
}

function downloadBytesInBrowser({ filename, bytes, mime }: DownloadBytesInput): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: mime ?? 'application/octet-stream',
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

/**
 * Save bytes to a user-chosen file. Uses the registered desktop handler when
 * available; otherwise falls back to a browser download.
 */
export async function downloadBytes(input: DownloadBytesInput): Promise<void> {
  if (_downloadBytes) {
    await _downloadBytes(input)
    return
  }
  downloadBytesInBrowser(input)
}
