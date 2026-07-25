export type PreviewKind = 'image' | 'pdf' | 'audio' | 'video' | 'text' | 'other'

export interface DetectedFormat {
  label: string
  mime: string
  extension: string
  kind: PreviewKind
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false
  }
  return true
}

/** Best-effort file-type detection from the leading magic bytes. */
export function detectBinaryFormat(bytes: Uint8Array): DetectedFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return { label: 'PNG image', mime: 'image/png', extension: 'png', kind: 'image' }
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { label: 'JPEG image', mime: 'image/jpeg', extension: 'jpg', kind: 'image' }
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return { label: 'GIF image', mime: 'image/gif', extension: 'gif', kind: 'image' }
  }
  if (startsWith(bytes, [0x42, 0x4d])) {
    return { label: 'BMP image', mime: 'image/bmp', extension: 'bmp', kind: 'image' }
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { label: 'WebP image', mime: 'image/webp', extension: 'webp', kind: 'image' }
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return { label: 'PDF document', mime: 'application/pdf', extension: 'pdf', kind: 'pdf' }
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    return { label: 'ZIP archive', mime: 'application/zip', extension: 'zip', kind: 'other' }
  }
  if (startsWith(bytes, [0x1f, 0x8b])) {
    return { label: 'GZIP archive', mime: 'application/gzip', extension: 'gz', kind: 'other' }
  }
  if (startsWith(bytes, [0x49, 0x44, 0x33]) || startsWith(bytes, [0xff, 0xfb])) {
    return { label: 'MP3 audio', mime: 'audio/mpeg', extension: 'mp3', kind: 'audio' }
  }
  if (bytes.length >= 8 && startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    return { label: 'MP4 video', mime: 'video/mp4', extension: 'mp4', kind: 'video' }
  }
  return null
}

const TEXT_MIME_ALIASES: Record<string, DetectedFormat> = {
  'text/csv': { label: 'CSV', mime: 'text/csv', extension: 'csv', kind: 'text' },
  'application/csv': { label: 'CSV', mime: 'text/csv', extension: 'csv', kind: 'text' },
  'text/plain': { label: 'Text', mime: 'text/plain', extension: 'txt', kind: 'text' },
  'text/html': { label: 'HTML', mime: 'text/html', extension: 'html', kind: 'text' },
  'text/css': { label: 'CSS', mime: 'text/css', extension: 'css', kind: 'text' },
  'text/javascript': {
    label: 'JavaScript',
    mime: 'text/javascript',
    extension: 'js',
    kind: 'text',
  },
  'application/javascript': {
    label: 'JavaScript',
    mime: 'text/javascript',
    extension: 'js',
    kind: 'text',
  },
  'application/json': { label: 'JSON', mime: 'application/json', extension: 'json', kind: 'text' },
  'text/json': { label: 'JSON', mime: 'application/json', extension: 'json', kind: 'text' },
  'text/xml': { label: 'XML', mime: 'text/xml', extension: 'xml', kind: 'text' },
  'application/xml': { label: 'XML', mime: 'application/xml', extension: 'xml', kind: 'text' },
  'text/markdown': { label: 'Markdown', mime: 'text/markdown', extension: 'md', kind: 'text' },
  'text/tab-separated-values': {
    label: 'TSV',
    mime: 'text/tab-separated-values',
    extension: 'tsv',
    kind: 'text',
  },
  'text/tsv': {
    label: 'TSV',
    mime: 'text/tab-separated-values',
    extension: 'tsv',
    kind: 'text',
  },
}

const EXTENSION_FORMATS: Record<string, DetectedFormat> = {
  csv: TEXT_MIME_ALIASES['text/csv'],
  tsv: TEXT_MIME_ALIASES['text/tab-separated-values'],
  txt: TEXT_MIME_ALIASES['text/plain'],
  text: TEXT_MIME_ALIASES['text/plain'],
  log: { label: 'Log', mime: 'text/plain', extension: 'log', kind: 'text' },
  md: TEXT_MIME_ALIASES['text/markdown'],
  markdown: TEXT_MIME_ALIASES['text/markdown'],
  html: TEXT_MIME_ALIASES['text/html'],
  htm: TEXT_MIME_ALIASES['text/html'],
  css: TEXT_MIME_ALIASES['text/css'],
  js: TEXT_MIME_ALIASES['text/javascript'],
  mjs: TEXT_MIME_ALIASES['text/javascript'],
  ts: { label: 'TypeScript', mime: 'text/plain', extension: 'ts', kind: 'text' },
  json: TEXT_MIME_ALIASES['application/json'],
  xml: TEXT_MIME_ALIASES['text/xml'],
  svg: { label: 'SVG', mime: 'image/svg+xml', extension: 'svg', kind: 'text' },
  yaml: { label: 'YAML', mime: 'text/plain', extension: 'yaml', kind: 'text' },
  yml: { label: 'YAML', mime: 'text/plain', extension: 'yml', kind: 'text' },
  sql: { label: 'SQL', mime: 'text/plain', extension: 'sql', kind: 'text' },
  '4dm': { label: '4D method', mime: 'text/plain', extension: '4dm', kind: 'text' },
}

/** Map a MIME / Content-Type string to a previewable format when magic bytes are absent. */
export function formatFromContentType(
  contentType: string | undefined | null
): DetectedFormat | null {
  if (!contentType) return null
  const mime = contentType.split(';')[0]?.trim().toLowerCase()
  if (!mime) return null

  if (mime === 'application/pdf') {
    return { label: 'PDF document', mime, extension: 'pdf', kind: 'pdf' }
  }
  if (mime === 'image/svg+xml') {
    return { label: 'SVG', mime, extension: 'svg', kind: 'text' }
  }
  if (mime.startsWith('image/')) {
    const extension = mime.slice('image/'.length).replace('jpeg', 'jpg') || 'img'
    return { label: `${extension.toUpperCase()} image`, mime, extension, kind: 'image' }
  }
  if (mime.startsWith('audio/')) {
    const extension = mime.slice('audio/'.length) || 'audio'
    return { label: 'Audio', mime, extension, kind: 'audio' }
  }
  if (mime.startsWith('video/')) {
    const extension = mime.slice('video/'.length) || 'video'
    return { label: 'Video', mime, extension, kind: 'video' }
  }

  const known = TEXT_MIME_ALIASES[mime]
  if (known) return { ...known, mime }

  if (mime.startsWith('text/')) {
    const extension = mime.slice('text/'.length) || 'txt'
    return { label: 'Text', mime, extension, kind: 'text' }
  }

  return null
}

/** Infer format from a file / attachment name extension. */
export function formatFromFileName(fileName: string | undefined | null): DetectedFormat | null {
  if (!fileName) return null
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return null
  const extension = base.slice(dot + 1).toLowerCase()
  const known = EXTENSION_FORMATS[extension]
  return known ? { ...known } : null
}

/**
 * Treat mostly-printable UTF-8 (or UTF-8 BOM) payloads as plain text when no
 * stronger format was detected.
 */
export function detectTextFormat(bytes: Uint8Array): DetectedFormat | null {
  if (bytes.length === 0) return null

  let offset = 0
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) offset = 3

  const sample = bytes.subarray(offset, Math.min(bytes.length, offset + 4096))
  if (sample.length === 0) {
    return { label: 'Text', mime: 'text/plain', extension: 'txt', kind: 'text' }
  }

  let suspicious = 0
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i]
    // Allow tab/LF/CR and printable ASCII; tolerate high bytes (UTF-8).
    if (b === 0) return null
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) suspicious += 1
  }
  if (suspicious / sample.length > 0.02) return null

  return { label: 'Text', mime: 'text/plain', extension: 'txt', kind: 'text' }
}

/** Resolve the best format from magic bytes, MIME, filename, then text sniffing. */
export function resolvePreviewFormat(options: {
  bytes: Uint8Array
  contentType?: string | null
  fileName?: string | null
}): DetectedFormat | null {
  return (
    detectBinaryFormat(options.bytes) ??
    formatFromContentType(options.contentType) ??
    formatFromFileName(options.fileName) ??
    detectTextFormat(options.bytes)
  )
}

export function isPreviewableFormat(format: DetectedFormat | null | undefined): boolean {
  return format != null && format.kind !== 'other'
}

export function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new Blob([ab as ArrayBuffer], { type: mime })
}

/** Decode bytes as UTF-8 text (strips a leading BOM when present). */
export function bytesToText(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return text.replace(/^\uFEFF/, '')
}

/** Monaco / CodeEditor language id for a text format. */
export function monacoLanguageForFormat(format: DetectedFormat | null | undefined): string {
  if (format?.kind !== 'text') return 'plaintext'
  switch (format.extension) {
    case 'json':
      return 'json'
    case 'html':
    case 'htm':
    case 'svg':
      return 'html'
    case 'css':
      return 'css'
    case 'js':
    case 'mjs':
      return 'javascript'
    case 'ts':
      return 'typescript'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'xml':
      return 'xml'
    case 'sql':
      return 'sql'
    case 'yaml':
    case 'yml':
      return 'yaml'
    default:
      return 'plaintext'
  }
}
