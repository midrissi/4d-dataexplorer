import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler, AssistantToolRegistry } from '@4djs/assistant/tools'
import { refreshAssistantMethodTools } from '~/assistant/method-tools'
import { client } from '~/lib/api'
import { isAssistantLlmConfigured } from '~/lib/assistant-llm-configured'
import { mergeCatalogIntoMetadata, touchMetadata } from '~/lib/assistant-metadata-schema'
import type { AttributeExclusionFilter, DescriptionTaskFilter } from '~/lib/description-task-filter'
import {
  collectDescriptionTasks,
  generateAllMetadataDescriptions,
} from '~/lib/generate-all-metadata-descriptions'
import {
  applyMetadataDescriptionUpdates,
  clearMetadataDescriptions,
  parseMetadataDescriptionUpdate,
} from '~/lib/metadata-description-mutations'
import { getAssistantMetadataSchema, saveAssistantMetadataSchema } from '~/lib/storage'
import { useTabsStore } from '~/store/tabs'

const TASK_TYPES = [
  'dataclass',
  'attribute',
  'dataclass-method',
  'singleton',
  'singleton-method',
  'catalog-method',
] as const

function parseIncludeTypes(value: unknown): DescriptionTaskFilter['includeTypes'] | undefined {
  if (!Array.isArray(value)) return undefined
  const include = value.filter(
    (item): item is (typeof TASK_TYPES)[number] =>
      typeof item === 'string' && TASK_TYPES.includes(item as (typeof TASK_TYPES)[number])
  )
  return include.length > 0 ? include : undefined
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  )
  return items.length > 0 ? items : undefined
}

function parseAttributeExclusion(value: unknown): AttributeExclusionFilter | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const input = value as Record<string, unknown>
  const filter: AttributeExclusionFilter = {}

  const names = parseStringArray(input.names)
  if (names) filter.names = names

  if (typeof input.namePattern === 'string' && input.namePattern.trim()) {
    filter.namePattern = input.namePattern.trim()
  }
  if (input.idLike === true) filter.idLike = true
  if (input.identifying === true) filter.identifying = true
  if (input.primaryKeys === true) filter.primaryKeys = true

  return Object.keys(filter).length > 0 ? filter : undefined
}

function parseDescriptionTaskFilter(args: Record<string, unknown>): DescriptionTaskFilter {
  const filter: DescriptionTaskFilter = {}

  const includeTypes = parseIncludeTypes(args.include)
  if (includeTypes) filter.includeTypes = includeTypes

  const dataclassNames = parseStringArray(args.dataclassNames)
  if (dataclassNames) filter.dataclassNames = dataclassNames

  const excludeDataclasses = parseStringArray(args.excludeDataclasses)
  if (excludeDataclasses) filter.excludeDataclasses = excludeDataclasses

  const excludeAttributes = parseAttributeExclusion(args.excludeAttributes)
  if (excludeAttributes) filter.excludeAttributes = excludeAttributes

  return filter
}

function countTasksByType(tasks: ReturnType<typeof collectDescriptionTasks>) {
  const counts: Record<string, number> = {}
  for (const task of tasks) {
    counts[task.type] = (counts[task.type] ?? 0) + 1
  }
  return counts
}

const FILTER_INPUT_PROPERTIES = {
  include: {
    type: 'array',
    items: { type: 'string', enum: [...TASK_TYPES] },
    description:
      'Task types to affect. For "dataclasses and fields" use ["dataclass", "attribute"]. Omit to include all types.',
  },
  dataclassNames: {
    type: 'array',
    items: { type: 'string' },
    description: 'Optional dataclass whitelist.',
  },
  excludeDataclasses: {
    type: 'array',
    items: { type: 'string' },
    description: 'Dataclasses to skip.',
  },
  excludeAttributes: {
    type: 'object',
    description:
      'Attribute exclusion rules for attribute tasks (names, namePattern, idLike, identifying, primaryKeys).',
    properties: {
      names: { type: 'array', items: { type: 'string' } },
      namePattern: { type: 'string' },
      idLike: {
        type: 'boolean',
        description:
          'Exclude primary keys, identifying fields, and common ID field names (ID, *ID).',
      },
      identifying: { type: 'boolean' },
      primaryKeys: { type: 'boolean' },
    },
  },
} as const

function parseMetadataUpdates(value: unknown) {
  if (!Array.isArray(value)) return []
  const updates = []
  for (const item of value) {
    const parsed = parseMetadataDescriptionUpdate(item)
    if (parsed) updates.push(parsed)
  }
  return updates
}

async function loadMetadataContext() {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const existing = getAssistantMetadataSchema()
  const metadata = mergeCatalogIntoMetadata(catalog, existing)
  saveAssistantMetadataSchema(metadata)
  return { catalog, metadata }
}

export function buildMetadataTools(registry: AssistantToolRegistry): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@metadata/state',
        description:
          'Return assistant metadata documentation state: missing description counts by type, whether the LLM is configured, and last update time. Use before bulk generation to scope work.',
        inputSchema: {
          type: 'object',
          properties: {
            onlyMissing: {
              type: 'boolean',
              description: 'Count only items without descriptions (default true).',
            },
            include: {
              type: 'array',
              items: { type: 'string', enum: [...TASK_TYPES] },
              description: 'Optional task types to count (default: all).',
            },
            dataclassNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional dataclass whitelist.',
            },
            excludeDataclasses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Dataclasses to skip.',
            },
            excludeAttributes: {
              type: 'object',
              description:
                'Attribute exclusion rules for counts on attribute tasks (names, namePattern, idLike, identifying, primaryKeys).',
              properties: {
                names: { type: 'array', items: { type: 'string' } },
                namePattern: { type: 'string' },
                idLike: {
                  type: 'boolean',
                  description:
                    'Exclude primary keys, identifying fields, and common ID field names (ID, *ID).',
                },
                identifying: { type: 'boolean' },
                primaryKeys: { type: 'boolean' },
              },
            },
          },
          additionalProperties: false,
        },
      },
      invoke: async (args) => {
        const { catalog, metadata } = await loadMetadataContext()
        const filter = parseDescriptionTaskFilter(args)
        const onlyMissing = args.onlyMissing !== false
        const tasks = collectDescriptionTasks(catalog, metadata, onlyMissing, filter)

        return toolResultOk({
          llmConfigured: isAssistantLlmConfigured(),
          onlyMissing,
          taskCount: tasks.length,
          tasksByType: countTasksByType(tasks),
          updatedAt: metadata.updatedAt,
          dataclassCount: catalog.dataClasses?.length ?? 0,
        })
      },
    },
    {
      definition: {
        name: '@metadata/generate-descriptions',
        description:
          'Generate AI descriptions for assistant metadata (dataclasses, attributes, methods, singletons). Supports filters such as only missing entries, specific dataclasses, and excluding ID-like attribute fields. Requires a configured LLM. Safe to run without confirmation — updates local metadata documentation only.',
        inputSchema: {
          type: 'object',
          properties: {
            onlyMissing: {
              type: 'boolean',
              description: 'Generate only for items without descriptions (default true).',
            },
            include: {
              type: 'array',
              items: { type: 'string', enum: [...TASK_TYPES] },
              description:
                'Task types to generate. For "dataclasses and fields" use ["dataclass", "attribute"].',
            },
            dataclassNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional dataclass whitelist.',
            },
            excludeDataclasses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Dataclasses to skip.',
            },
            excludeAttributes: {
              type: 'object',
              description:
                'Exclude attribute tasks matching these rules. For "except IDs" use { "idLike": true }.',
              properties: {
                names: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Exact attribute names (case-insensitive).',
                },
                namePattern: {
                  type: 'string',
                  description: 'Regex tested against attribute names.',
                },
                idLike: {
                  type: 'boolean',
                  description:
                    'Exclude primary keys, identifying fields, and common ID field names (ID, *ID).',
                },
                identifying: { type: 'boolean' },
                primaryKeys: { type: 'boolean' },
              },
            },
            openMetadataEditor: {
              type: 'boolean',
              description: 'Open the Assistant Metadata Editor tab when generation completes.',
            },
          },
          additionalProperties: false,
        },
      },
      invoke: async (args) => {
        if (!isAssistantLlmConfigured()) {
          return toolResultErr(
            'LLM is not configured. Configure the assistant model in Settings before generating metadata descriptions.'
          )
        }

        const { catalog, metadata } = await loadMetadataContext()
        const filter = parseDescriptionTaskFilter(args)
        const onlyMissing = args.onlyMissing !== false
        const plannedTasks = collectDescriptionTasks(catalog, metadata, onlyMissing, filter)

        if (plannedTasks.length === 0) {
          return toolResultOk({
            generated: 0,
            failed: 0,
            skipped: 0,
            message: 'No metadata descriptions matched the requested filters.',
          })
        }

        const result = await generateAllMetadataDescriptions({
          catalog,
          metadata,
          onlyMissing,
          filter,
          onMetadataUpdate: (next) => {
            saveAssistantMetadataSchema(touchMetadata(next))
          },
        })

        saveAssistantMetadataSchema(touchMetadata(result.metadata))
        await refreshAssistantMethodTools(registry)

        if (args.openMetadataEditor === true) {
          useTabsStore.getState().openAssistantMetadataTab()
        }

        return toolResultOk({
          generated: result.generated,
          failed: result.failed,
          cancelled: result.cancelled,
          planned: plannedTasks.length,
          tasksByType: countTasksByType(plannedTasks),
          updatedAt: result.metadata.updatedAt,
          message: result.cancelled
            ? 'Metadata generation was cancelled before completion.'
            : `Generated ${result.generated} description(s)${result.failed > 0 ? `; ${result.failed} failed` : ''}.`,
        })
      },
    },
    {
      definition: {
        name: '@metadata/clear-descriptions',
        description:
          'Clear assistant metadata descriptions (and optionally method parameter schemas). Supports the same filters as generate-descriptions. Use for requests like "clear all metadata descriptions". Updates local metadata documentation only — no confirmation required.',
        inputSchema: {
          type: 'object',
          properties: {
            ...FILTER_INPUT_PROPERTIES,
            onlyDescribed: {
              type: 'boolean',
              description:
                'Clear only items that currently have a description or schema (default true).',
            },
            clearArguments: {
              type: 'boolean',
              description: 'Also clear method parameter argument schemas (default false).',
            },
            clearParamsSchema: {
              type: 'boolean',
              description: 'Deprecated alias for clearArguments.',
            },
            openMetadataEditor: {
              type: 'boolean',
              description: 'Open the Assistant Metadata Editor tab when clearing completes.',
            },
          },
          additionalProperties: false,
        },
      },
      invoke: async (args) => {
        const { catalog, metadata } = await loadMetadataContext()
        const filter = parseDescriptionTaskFilter(args)
        const result = clearMetadataDescriptions({
          catalog,
          metadata,
          filter,
          onlyDescribed: args.onlyDescribed !== false,
          clearArguments: args.clearArguments === true || args.clearParamsSchema === true,
        })

        saveAssistantMetadataSchema(touchMetadata(result.metadata))
        await refreshAssistantMethodTools(registry)

        if (args.openMetadataEditor === true) {
          useTabsStore.getState().openAssistantMetadataTab()
        }

        return toolResultOk({
          cleared: result.cleared,
          matched: result.matched,
          updatedAt: touchMetadata(result.metadata).updatedAt,
          message:
            result.cleared > 0
              ? `Cleared ${result.cleared} metadata description(s) or schema(s).`
              : 'No metadata descriptions matched the requested filters.',
        })
      },
    },
    {
      definition: {
        name: '@metadata/update-descriptions',
        description:
          'Set or replace specific assistant metadata descriptions (and optional method parameter schemas). Use for precise edits without AI generation. Updates local metadata documentation only — no confirmation required.',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: [...TASK_TYPES] },
                  dataclassName: { type: 'string' },
                  attributeName: { type: 'string' },
                  singletonName: { type: 'string' },
                  methodName: { type: 'string' },
                  description: { type: 'string' },
                  arguments: {
                    type: 'array',
                    description: 'Positional method parameter JSON Schema entries.',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        description: { type: 'string' },
                      },
                      required: ['type'],
                    },
                  },
                  clearArguments: {
                    type: 'boolean',
                    description: 'Remove the stored arguments schema for a method update.',
                  },
                  clearParamsSchema: {
                    type: 'boolean',
                    description: 'Deprecated alias for clearArguments.',
                  },
                },
                required: ['type'],
              },
            },
            openMetadataEditor: {
              type: 'boolean',
              description: 'Open the Assistant Metadata Editor tab after applying updates.',
            },
          },
          required: ['updates'],
          additionalProperties: false,
        },
      },
      invoke: async (args) => {
        const updates = parseMetadataUpdates(args.updates)
        if (updates.length === 0) {
          return toolResultErr('Provide at least one valid update in updates[].')
        }

        const { catalog, metadata } = await loadMetadataContext()
        const result = applyMetadataDescriptionUpdates({ catalog, metadata, updates })
        saveAssistantMetadataSchema(touchMetadata(result.metadata))
        await refreshAssistantMethodTools(registry)

        if (args.openMetadataEditor === true) {
          useTabsStore.getState().openAssistantMetadataTab()
        }

        if (result.updated === 0) {
          return toolResultErr(result.errors.join('; ') || 'No metadata updates were applied.')
        }

        return toolResultOk({
          updated: result.updated,
          errors: result.errors,
          updatedAt: touchMetadata(result.metadata).updatedAt,
          message:
            result.errors.length > 0
              ? `Applied ${result.updated} update(s) with ${result.errors.length} error(s).`
              : `Applied ${result.updated} metadata update(s).`,
        })
      },
    },
  ]
}
