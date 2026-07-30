import type { DownloadBytesFn } from '~/lib/download-bytes'
import { canShareFiles, shareBytes } from '~/lib/download-bytes'

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'AbortError') return true
  return false
}

function isUserCancel(err: unknown): boolean {
  if (isAbortError(err)) return true
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /cancel/i.test(msg)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'download.bin'
}

/** Stage bytes in app cache and return an absolute filesystem path for native code. */
async function stageInAppCache(input: {
  filename: string
  bytes: Uint8Array
}): Promise<{ sourcePath: string; cleanup: () => Promise<void> }> {
  const { writeFile, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
  const { appCacheDir, join } = await import('@tauri-apps/api/path')

  const safeName = sanitizeFilename(input.filename)
  const cacheName = `_dl_${Date.now()}_${safeName}`
  await writeFile(cacheName, input.bytes, { baseDir: BaseDirectory.AppCache })
  const dir = await appCacheDir()
  const sourcePath = await join(dir, cacheName)

  return {
    sourcePath,
    cleanup: async () => {
      try {
        await remove(cacheName, { baseDir: BaseDirectory.AppCache })
      } catch {
        // Best-effort cleanup.
      }
    },
  }
}

/**
 * Android: MediaStore → Downloads (or SAF picker fallback).
 * Avoids Web Share (Download button must save) and the fs plugin's 0-byte
 * content:// write bug (plugins-workspace#3356).
 */
async function androidDownloadBytes(input: {
  filename: string
  bytes: Uint8Array
  mime?: string
}): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const staged = await stageInAppCache(input)
  try {
    try {
      await invoke('plugin:save-bytes|save_to_downloads', {
        filename: sanitizeFilename(input.filename),
        mimeType: input.mime ?? 'application/octet-stream',
        sourcePath: staged.sourcePath,
      })
      return
    } catch (mediaStoreErr) {
      // Fall through to the system save picker.
      if (isUserCancel(mediaStoreErr)) return
    }

    const { save } = await import('@tauri-apps/plugin-dialog')
    const extension = input.filename.includes('.') ? input.filename.split('.').pop() : undefined
    let uri: string | null
    try {
      uri = await save({
        defaultPath: sanitizeFilename(input.filename),
        filters: extension
          ? [{ name: extension.toUpperCase(), extensions: [extension] }]
          : undefined,
      })
    } catch (err) {
      if (isUserCancel(err)) return
      throw err
    }
    if (!uri) return

    await invoke('plugin:save-bytes|write_to_uri', {
      uri,
      sourcePath: staged.sourcePath,
    })
  } finally {
    await staged.cleanup()
  }
}

/**
 * Mobile save path.
 *
 * Android: write into the public Downloads collection via MediaStore (or a
 * SAF save picker fallback). iOS: prefer the share sheet (Save to Files),
 * then Document directory — `dialog.save()` is unreliable there.
 */
export const tauriDownloadBytes: DownloadBytesFn = async (input) => {
  if (isAndroid()) {
    await androidDownloadBytes(input)
    return
  }

  if (canShareFiles()) {
    try {
      await shareBytes(input)
      return
    } catch (err) {
      if (isAbortError(err)) return
      // Share failed for another reason — fall through to filesystem write.
    }
  }

  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
  try {
    await writeFile(input.filename, input.bytes, { baseDir: BaseDirectory.Document })
  } catch {
    await writeFile(input.filename, input.bytes, { baseDir: BaseDirectory.Download })
  }
}
