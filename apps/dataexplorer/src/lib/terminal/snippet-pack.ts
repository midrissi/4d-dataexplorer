import { downloadBytes } from '~/lib/download-bytes'

/**
 * Portable ORDA terminal snippet pack — JSON gzipped into one file.
 */

export const SNIPPET_PACK_FORMAT = 'orda-terminal-snippets' as const
export const SNIPPET_PACK_VERSION = 1 as const
export const SNIPPET_PACK_EXTENSION = '.orda-snippets.gz'
export const SNIPPET_PACK_MIME = 'application/gzip'

export type SnippetPackItem = {
  name: string
  code: string
}

export type SnippetPack = {
  format: typeof SNIPPET_PACK_FORMAT
  version: typeof SNIPPET_PACK_VERSION
  exportedAt: number
  snippets: SnippetPackItem[]
}

export type ParseSnippetPackResult = { ok: true; pack: SnippetPack } | { ok: false; error: string }

function textEncoder(): TextEncoder {
  return new TextEncoder()
}

function textDecoder(): TextDecoder {
  return new TextDecoder()
}

/** Gzip-compress bytes (browser CompressionStream or Bun.gzipSync). */
export async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  const bunGzip = (globalThis as { Bun?: { gzipSync?: (b: Uint8Array) => Uint8Array } }).Bun
    ?.gzipSync
  if (typeof bunGzip === 'function') {
    return bunGzip(bytes)
  }
  throw new Error('gzip compression is not available in this environment')
}

/** Gunzip bytes (browser DecompressionStream or Bun.gunzipSync). */
export async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  const bunGunzip = (globalThis as { Bun?: { gunzipSync?: (b: Uint8Array) => Uint8Array } }).Bun
    ?.gunzipSync
  if (typeof bunGunzip === 'function') {
    return bunGunzip(bytes)
  }
  throw new Error('gzip decompression is not available in this environment')
}

export function buildSnippetPack(
  snippets: Array<{ name: string; code: string }>,
  exportedAt = Date.now()
): SnippetPack {
  return {
    format: SNIPPET_PACK_FORMAT,
    version: SNIPPET_PACK_VERSION,
    exportedAt,
    snippets: snippets.map((s) => ({
      name: s.name.trim(),
      code: s.code,
    })),
  }
}

export async function encodeSnippetPack(pack: SnippetPack): Promise<Uint8Array> {
  const json = JSON.stringify(pack)
  return gzipCompress(textEncoder().encode(json))
}

export function parseSnippetPackJson(raw: unknown): ParseSnippetPackResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid snippet pack: expected a JSON object' }
  }
  const obj = raw as Record<string, unknown>
  if (obj.format !== SNIPPET_PACK_FORMAT) {
    return { ok: false, error: 'Invalid snippet pack: unrecognized format' }
  }
  if (obj.version !== SNIPPET_PACK_VERSION) {
    return { ok: false, error: `Unsupported snippet pack version: ${String(obj.version)}` }
  }
  if (!Array.isArray(obj.snippets)) {
    return { ok: false, error: 'Invalid snippet pack: missing snippets array' }
  }

  const snippets: SnippetPackItem[] = []
  for (const item of obj.snippets) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid snippet pack: each snippet must be an object' }
    }
    const row = item as Record<string, unknown>
    if (typeof row.name !== 'string' || typeof row.code !== 'string') {
      return { ok: false, error: 'Invalid snippet pack: snippets need name and code strings' }
    }
    snippets.push({ name: row.name, code: row.code })
  }

  return {
    ok: true,
    pack: {
      format: SNIPPET_PACK_FORMAT,
      version: SNIPPET_PACK_VERSION,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
      snippets,
    },
  }
}

export async function decodeSnippetPack(bytes: Uint8Array): Promise<ParseSnippetPackResult> {
  try {
    const inflated = await gzipDecompress(bytes)
    const text = textDecoder().decode(inflated)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, error: 'Invalid snippet pack: not valid JSON after decompress' }
    }
    return parseSnippetPackJson(parsed)
  } catch {
    return { ok: false, error: 'Invalid snippet pack: could not decompress gzip' }
  }
}

export function defaultSnippetPackFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `orda-snippets-${y}-${m}-${d}${SNIPPET_PACK_EXTENSION}`
}

/**
 * Save the compressed pack via the shared download helper.
 * On Tauri mobile/desktop this uses the registered native handler (share sheet /
 * Documents) — raw `<a download>` fails in iOS WKWebView (NSURLError -3000).
 */
export async function downloadSnippetPackBytes(bytes: Uint8Array, filename: string): Promise<void> {
  await downloadBytes({
    filename,
    bytes,
    mime: SNIPPET_PACK_MIME,
  })
}
