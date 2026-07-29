import type { DownloadBytesFn } from '~/lib/download-bytes'
import { canShareFiles, shareBytes } from '~/lib/download-bytes'

/**
 * Mobile save path. Tauri's `dialog.save()` is unreliable here (often returns
 * null with no UI on iOS, and Android content:// writes can yield 0-byte files).
 *
 * Prefer the Web Share sheet immediately (must stay in the user-gesture window
 * on iOS). Fall back to writing into Download/Document when share is unavailable.
 */
export const tauriDownloadBytes: DownloadBytesFn = async (input) => {
  if (canShareFiles()) {
    try {
      await shareBytes(input)
      return
    } catch (err) {
      // User dismissed the sheet — treat as cancel, not failure.
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return
      // Share failed for another reason — fall through to filesystem write.
    }
  }

  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
  try {
    await writeFile(input.filename, input.bytes, { baseDir: BaseDirectory.Download })
  } catch {
    await writeFile(input.filename, input.bytes, { baseDir: BaseDirectory.Document })
  }
}
