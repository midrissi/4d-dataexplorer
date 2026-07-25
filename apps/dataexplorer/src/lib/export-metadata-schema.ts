import type { AssistantMetadataSchema } from './assistant-metadata-schema'
import { sanitizeMetadataFilename } from './assistant-metadata-schema'

export function getMetadataExportFilename(databaseName?: string): string {
  const base = sanitizeMetadataFilename(databaseName ?? 'database')
  return `${base}.metadata-schema.json`
}

export function downloadMetadataSchema(
  metadata: AssistantMetadataSchema,
  databaseName?: string
): void {
  const filename = getMetadataExportFilename(databaseName ?? metadata.databaseName)
  const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
