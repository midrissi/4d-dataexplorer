import type { CatalogAllResponse, DataClassAttribute } from '@4d/rest'
import { parseSuggestedPromptsResponse, requestLlmCompletion } from '@4djs/assistant/core'
import { client } from '~/lib/api'
import { isAssistantLlmConfigured, isCloudLlmOffline } from '~/lib/assistant-llm-configured'

export type AiModalExampleKind = 'query' | 'ask' | 'generate'

export type AiModalPromptExample = {
  id: string
  /** Full prompt inserted into the textarea */
  prompt: string
}

type SchemaHints = {
  stringAttr?: string
  dateAttr?: string
  boolAttr?: string
  relationAttr?: string
  relatedType?: string
}

function isStorageLike(attr: DataClassAttribute): boolean {
  return attr.kind === 'storage' || attr.kind === 'calculated' || !attr.kind
}

function isRelation(attr: DataClassAttribute): boolean {
  return (
    attr.kind === 'relatedEntity' ||
    attr.behavior === 'relatedEntity' ||
    attr.kind === 'relatedEntities' ||
    attr.behavior === 'relatedEntities'
  )
}

function pickSchemaHints(catalog: CatalogAllResponse, dataclassName: string): SchemaHints {
  const dc = catalog.dataClasses?.find((item) => item.name === dataclassName)
  const attrs = dc?.attributes ?? []
  const storage = attrs.filter(isStorageLike)

  const stringAttr =
    storage.find((a) => {
      const n = a.name.toLowerCase()
      return (
        a.type === 'string' &&
        (n.includes('name') || n.includes('nom') || n === 'title' || n === 'label' || n === 'code')
      )
    })?.name ?? storage.find((a) => a.type === 'string')?.name

  const dateAttr =
    storage.find((a) => a.type === 'date' || /date|created|updated|time/i.test(a.name))?.name ??
    undefined

  const boolAttr =
    storage.find((a) => a.type === 'bool' || /active|enabled|valid|status/i.test(a.name))?.name ??
    undefined

  const relatedEntity = attrs.find(
    (a) => a.kind === 'relatedEntity' || a.behavior === 'relatedEntity'
  )
  const relatedEntities = attrs.find(
    (a) => a.kind === 'relatedEntities' || a.behavior === 'relatedEntities'
  )
  // Prefer collection relation for distribution/chart examples (parent → children).
  const relation = relatedEntities ?? relatedEntity
  return {
    stringAttr,
    dateAttr,
    boolAttr,
    relationAttr: relation?.name,
    relatedType: relation
      ? String(relation.type || relation.path || '').trim() || undefined
      : undefined,
  }
}

function summarizeSchemaForExamples(catalog: CatalogAllResponse, dataclassName: string): string {
  const dc = catalog.dataClasses?.find((item) => item.name === dataclassName)
  if (!dc) return `(Dataclass "${dataclassName}" not found.)`
  const lines = (dc.attributes ?? []).slice(0, 60).map((attr) => {
    if (isRelation(attr)) {
      return `- ${attr.name}: ${attr.kind}${attr.behavior ? `/${attr.behavior}` : ''} → ${attr.type || attr.path || '?'}`
    }
    return `- ${attr.name}: ${attr.type ?? 'unknown'} (${attr.kind ?? 'storage'})`
  })
  return `Dataclass ${dataclassName}\nAttributes:\n${lines.join('\n') || '(none)'}`
}

/** Schema-aware fallbacks when LLM is unavailable or generation fails. */
export function buildStaticAiModalPromptExamples(
  kind: AiModalExampleKind,
  dataclassName: string,
  catalog?: CatalogAllResponse | null
): AiModalPromptExample[] {
  const hints = catalog ? pickSchemaHints(catalog, dataclassName) : {}
  const nameAttr = hints.stringAttr ?? 'name'
  const sortAttr = hints.dateAttr ?? hints.stringAttr ?? nameAttr
  const relation = hints.relationAttr
  const related = hints.relatedType

  if (kind === 'query') {
    const examples: AiModalPromptExample[] = [
      {
        id: 'query-starts-with',
        prompt: `Find ${dataclassName} where ${nameAttr} starts with A`,
      },
      {
        id: 'query-sorted',
        prompt: hints.boolAttr
          ? `${dataclassName} where ${hints.boolAttr} is true, sorted by ${sortAttr} descending`
          : `Active ${dataclassName} sorted by ${sortAttr} descending`,
      },
    ]
    if (relation) {
      examples.push({
        id: 'query-same-related',
        prompt: related
          ? `Find ${dataclassName} with the same ${relation} as the first record`
          : `Find ${dataclassName} sharing the same ${relation} as the first record`,
      })
    } else {
      examples.push({
        id: 'query-select',
        prompt: `List ${dataclassName} showing ${nameAttr}${hints.dateAttr ? ` and ${hints.dateAttr}` : ''}, sorted by ${sortAttr}`,
      })
    }
    return examples
  }

  if (kind === 'ask') {
    const examples: AiModalPromptExample[] = [
      {
        id: 'ask-recent',
        prompt: `Show recent records from ${dataclassName} in a new tab`,
      },
      {
        id: 'ask-info',
        prompt: `How many records are in ${dataclassName}, and what are the main fields?`,
      },
    ]
    if (relation && related) {
      examples.push({
        id: 'ask-distribution',
        prompt: `Show ${dataclassName} distribution over ${relation} as a pie chart`,
      })
    } else {
      examples.push({
        id: 'ask-filter',
        prompt: `Show ${dataclassName} where ${nameAttr} starts with A in a new tab`,
      })
    }
    return examples
  }

  // generate
  return [
    {
      id: 'gen-realistic',
      prompt: `Use realistic ${nameAttr} values${relation ? ` and valid ${relation} links` : ''}`,
    },
    {
      id: 'gen-locale',
      prompt: `Use French names and set common fields to typical values`,
    },
    {
      id: 'gen-varied',
      prompt: hints.boolAttr
        ? `Mix ${hints.boolAttr}=true and false; vary ${nameAttr}`
        : `Vary ${nameAttr} widely; leave optional fields empty sometimes`,
    },
  ]
}

const KIND_INSTRUCTIONS: Record<AiModalExampleKind, string> = {
  query:
    'Each prompt should describe a Query-builder filter/sort/select the user wants (natural language). Prefer relation paths and concrete attribute names from the schema. Include one multi-step “same X as the first record” style prompt when a relation exists.',
  ask: 'Each prompt should be something the user would ask the AI to do with this dataclass (open filtered tabs, explain schema, sample data, relation distributions/charts). Avoid inventing attributes. Prefer safe read actions; at most one soft destructive example. When a relation exists, include one chart/distribution prompt.',
  generate:
    'Each prompt should be short additional instructions for generating sample entities (locale, field constraints, realism). Do not ask to open tabs or run queries.',
}

function parseExamplesContent(content: string | null): AiModalPromptExample[] {
  if (!content?.trim()) throw new Error('LLM returned empty examples')
  const trimmed = content.trim()
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed
  const parsed = JSON.parse(jsonText) as unknown
  const prompts = parseSuggestedPromptsResponse(parsed)
  if (!prompts.length) throw new Error('LLM returned no valid examples')
  return prompts.slice(0, 5).map((p) => ({
    id: p.id,
    prompt: p.prompt || p.label,
  }))
}

/**
 * Generate dataclass-aware prompt examples via LLM.
 * Falls back to schema-aware static examples when LLM is not configured.
 */
export async function fetchAiModalPromptExamples(input: {
  kind: AiModalExampleKind
  dataclassName: string
  signal?: AbortSignal
}): Promise<AiModalPromptExample[]> {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const fallback = buildStaticAiModalPromptExamples(input.kind, input.dataclassName, catalog)

  if (!isAssistantLlmConfigured() || isCloudLlmOffline()) {
    return fallback
  }

  const schema = summarizeSchemaForExamples(catalog, input.dataclassName)

  try {
    const completion = await requestLlmCompletion({
      messages: [
        {
          role: 'user',
          content: [
            schema,
            '',
            `Modal kind: ${input.kind}`,
            KIND_INSTRUCTIONS[input.kind],
            '',
            `Generate exactly 3 diverse example prompts for the "${input.dataclassName}" AI modal.`,
            'Return ONLY JSON: { "prompts": [ { "id": "...", "label": "short title", "prompt": "full prompt text" } ] }',
            'Use only attributes/relations from the schema. Prompts must be natural language the user would type.',
          ].join('\n'),
        },
      ],
      tools: [],
      systemPrompt:
        'You generate short starter prompt examples for Data Explorer AI modals. Return valid JSON only.',
      responseFormat: { type: 'json_object' },
      signal: input.signal,
    })

    const examples = parseExamplesContent(completion.content)
    return examples.length > 0 ? examples : fallback
  } catch {
    return fallback
  }
}
