import type { AssistantMetadataSchema } from './assistant-metadata-schema'
import { sanitizeMetadataFilename } from './assistant-metadata-schema'
import { downloadBytes } from './download-bytes'

export function getMetadataExportFilename(databaseName?: string): string {
  const base = sanitizeMetadataFilename(databaseName ?? 'database')
  return `${base}.metadata-schema.json`
}

export async function downloadMetadataSchema(
  metadata: AssistantMetadataSchema,
  databaseName?: string
): Promise<void> {
  const filename = getMetadataExportFilename(databaseName ?? metadata.databaseName)
  const json = JSON.stringify(metadata, null, 2)
  await downloadBytes({
    filename,
    bytes: new TextEncoder().encode(json),
    mime: 'application/json',
  })
}
