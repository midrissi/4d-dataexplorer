import { ENTITY_IO_FORMATS } from './formats'
import type { EntityIoFormat, EntityIoFormatId } from './types'

const BY_ID = new Map(ENTITY_IO_FORMATS.map((f) => [f.id, f]))

export function listEntityIoFormats(): EntityIoFormat[] {
  return ENTITY_IO_FORMATS
}

export function getEntityIoFormat(id: EntityIoFormatId | string): EntityIoFormat | undefined {
  return BY_ID.get(id as EntityIoFormatId)
}

export function listExportFormats(): EntityIoFormat[] {
  return ENTITY_IO_FORMATS.filter((f) => f.capabilities.export)
}

export function listImportFormats(): EntityIoFormat[] {
  return ENTITY_IO_FORMATS.filter((f) => f.capabilities.import)
}

/** Detect format from filename extension and optional content sniff. */
export function detectEntityIoFormat(filename: string, text?: string): EntityIoFormat | undefined {
  const lower = filename.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''

  if (ext === 'json' || ext === 'jsonl' || ext === 'ndjson') {
    if (text?.trimStart().startsWith('{') && text.includes('"__ENTITIES"')) {
      return BY_ID.get('json-rest')
    }
    if (ext === 'jsonl' || ext === 'ndjson') return BY_ID.get('jsonl')
    if (text) {
      const lines = text.trim().split(/\r?\n/).filter(Boolean)
      if (
        lines.length > 1 &&
        lines.every((l) => l.trimStart().startsWith('{') && l.trimEnd().endsWith('}'))
      ) {
        return BY_ID.get('jsonl')
      }
    }
    return BY_ID.get('json')
  }

  for (const format of ENTITY_IO_FORMATS) {
    if (format.extensions.includes(ext)) return format
  }

  if (text) {
    const t = text.trimStart()
    if (t.startsWith('<?xml') || t.startsWith('<entities')) return BY_ID.get('xml')
    if (/^INSERT\s+INTO/i.test(t)) return BY_ID.get('sql')
    if (t.startsWith('- ') || t.startsWith('[')) return BY_ID.get('yaml')
    if (t.startsWith('{') || t.startsWith('[')) return BY_ID.get('json')
  }

  return undefined
}

export function defaultFilename(
  dataclassName: string,
  format: EntityIoFormat,
  suffix = ''
): string {
  const ext = format.extensions[0] ?? format.id
  const safe = dataclassName.replace(/[^\w.-]+/g, '_')
  return `${safe}${suffix}.${ext}`
}
