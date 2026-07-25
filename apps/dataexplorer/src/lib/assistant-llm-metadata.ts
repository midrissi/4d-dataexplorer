import type { AssistantLlmSettings } from '@4djs/assistant/core'
import { createDataExplorerLlmSettings } from '~/assistant/llm-config'
import { client } from './api'
import {
  formatMetadataForSystemPrompt,
  hasMetadataContent,
  mergeCatalogIntoMetadata,
} from './assistant-metadata-schema'
import { getAssistantMetadataSchema } from './storage'

export function appendMetadataToLlmSettings(
  base: AssistantLlmSettings,
  metadata = getAssistantMetadataSchema()
): AssistantLlmSettings {
  if (!hasMetadataContent(metadata)) return base

  const metadataSection = formatMetadataForSystemPrompt(metadata)
  const systemPrompt = `${base.systemPrompt ?? ''}${metadataSection}`.trim()

  return {
    ...base,
    systemPrompt,
  }
}

export async function createDataExplorerLlmSettingsWithMetadata(): Promise<AssistantLlmSettings> {
  const base = createDataExplorerLlmSettings()
  let metadata = getAssistantMetadataSchema()

  try {
    const catalog = await client.catalog.getAllWithMetadataCached()
    metadata = mergeCatalogIntoMetadata(catalog, metadata)
  } catch {
    // Use stored metadata when catalog is unavailable.
  }

  return appendMetadataToLlmSettings(base, metadata)
}
