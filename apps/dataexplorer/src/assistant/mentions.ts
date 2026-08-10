import type {
  AssistantMentionDetails,
  AssistantMentionItem,
  AssistantMentionsConfig,
} from '@4djs/assistant'
import { api } from '~/lib/api'
import { eventBus } from '~/lib/eventBus'
import { useDataExplorerStore } from '~/store'
import { useTabsStore } from '~/store/tabs'

type Catalog = Awaited<ReturnType<typeof api.getCatalog>>

function formatAttribute(attr: {
  name?: string
  type?: string
  kind?: string
  readOnly?: boolean
  foreignKey?: string
  path?: string
}): string {
  const name = attr.name ?? '?'
  const kind = attr.kind ?? 'storage'

  if (kind === 'relatedEntity' || kind === 'relatedEntities') {
    const relatedName = (attr.type || attr.path || 'unknown').trim()
    const bits = [`${name}: ${kind} → ${relatedName}`]
    if (attr.foreignKey) bits.push(`FK ${attr.foreignKey}`)
    return `- ${bits.join('; ')}`
  }

  const bits = [`${name}: ${attr.type ?? 'unknown'}`]
  if (kind !== 'storage') bits.push(`kind=${kind}`)
  if (attr.readOnly) bits.push('readOnly')
  return `- ${bits.join(', ')}`
}

function summarizeDataclass(dataclassName: string, catalog: Catalog): string {
  const dc = catalog.dataClasses?.find((item) => item.name === dataclassName)
  if (!dc) {
    return `### @${dataclassName}\n(Dataclass not found in catalog.)`
  }

  const attrs = (dc.attributes ?? [])
    .filter(
      (attr) =>
        attr.kind === 'storage' ||
        attr.kind === 'calculated' ||
        attr.kind === 'relatedEntity' ||
        attr.kind === 'relatedEntities' ||
        !attr.kind
    )
    .slice(0, 80)
    .map((attr) => formatAttribute(attr))

  const keyNames = (dc.key ?? []).map((k) => k.name).filter(Boolean)
  const keyLine = keyNames.length > 0 ? `Primary key: ${keyNames.join(', ')}\n` : ''
  const count = useDataExplorerStore
    .getState()
    .dataclasses.find((d) => d.name === dataclassName)?.count

  const countLine = typeof count === 'number' ? `Entity count: ${count}\n` : ''

  return [
    `### @${dataclassName}`,
    `${countLine}${keyLine}Attributes:\n${attrs.length > 0 ? attrs.join('\n') : '(no attributes)'}`,
  ].join('\n')
}

function toMentionItems(
  dataclasses: Array<{ name: string; count?: number | null }>
): AssistantMentionItem[] {
  return [...dataclasses]
    .map((dc) => ({
      id: dc.name,
      label: dc.name,
      kind: 'dataclass' as const,
      description:
        typeof dc.count === 'number' ? `${dc.count.toLocaleString()} entities` : 'dataclass',
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function buildDataclassDetails(mentionId: string): AssistantMentionDetails | null {
  const dc = useDataExplorerStore.getState().dataclasses.find((item) => item.name === mentionId)
  if (!dc) return null

  return {
    title: dc.name,
    subtitle: 'Dataclass',
    description:
      typeof dc.count === 'number'
        ? `${dc.count.toLocaleString()} entities in ${dc.collectionName}`
        : `Collection ${dc.collectionName}`,
    meta: [
      { label: 'Collection', value: dc.collectionName },
      ...(typeof dc.count === 'number'
        ? [{ label: 'Entities', value: dc.count.toLocaleString() }]
        : []),
    ],
    actions: [
      {
        id: 'show-data',
        label: 'Show data',
        description: 'Open this dataclass in a data tab',
        onSelect: () => {
          useTabsStore.getState().openTab(mentionId)
        },
      },
      {
        id: 'show-structure',
        label: 'Show in structure',
        description: 'Open the structure graph and highlight this class',
        onSelect: () => {
          void useTabsStore
            .getState()
            .openGraphTab()
            .then(() => {
              eventBus.emit('highlight-dataclass-in-graph', mentionId)
            })
        },
      },
    ],
  }
}

/** @mention dataclasses in the assistant composer, with schema injection for the LLM. */
export function createDataExplorerMentionsConfig(): AssistantMentionsConfig {
  return {
    /** Always sync — reads the live zustand catalog so autocomplete can open on `@`. */
    items: () => toMentionItems(useDataExplorerStore.getState().dataclasses),
    resolveContext: async (mentionedIds) => {
      if (mentionedIds.length === 0) return null
      try {
        const catalog = await api.getCatalog()
        return mentionedIds.map((id) => summarizeDataclass(id, catalog)).join('\n\n')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return `Could not load catalog for @mentions: ${message}`
      }
    },
    getDetails: (mentionId) => buildDataclassDetails(mentionId),
  }
}
