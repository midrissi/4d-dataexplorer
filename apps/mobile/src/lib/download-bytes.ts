import type { DownloadBytesFn } from '~/lib/download-bytes'

/**
 * Tauri save-dialog + filesystem write. Replaces the browser `<a download>`
 * path, which WebView does not honor for blob URLs (desktop and mobile).
 */
export const tauriDownloadBytes: DownloadBytesFn = async ({ filename, bytes }) => {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeFile } = await import('@tauri-apps/plugin-fs')

  const extension = filename.includes('.') ? filename.split('.').pop() : undefined
  const path = await save({
    defaultPath: filename,
    filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : undefined,
  })
  if (!path) return

  await writeFile(path, bytes)
}
