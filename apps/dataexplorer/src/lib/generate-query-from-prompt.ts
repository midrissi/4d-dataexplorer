import { requestLlmCompletion } from '@4djs/assistant/core'
import { client } from '~/lib/api'
import { isAssistantLlmConfigured } from '~/lib/assistant-llm-configured'
import {
  type FilterParam,
  type FilterParamType,
  normalizeQueryOptions,
  type QueryOptions,
} from '~/store/tabs'

const FILTER_PARAM_TYPES = new Set<FilterParamType>(['string', 'number', 'boolean', 'date', 'json'])

const SYSTEM_PROMPT = `You generate 4D REST / ORDA query options for Data Explorer from a natural-language request.
Return ONLY valid JSON (no markdown fences) with this shape:
{
  "filter": "4D filter expression",
  "filterParams": [{ "type": "string|number|boolean|date|json", "value": "..." }],
  "sort": "attributeName or empty string",
  "order": "asc" | "desc",
  "select": "comma-separated attribute names, or empty for all"
}

Rules (see 4D DataClass.query docs):
- Use real attribute names from the provided schema only. If the user says "name" but there is no name attribute, pick the closest string attribute (e.g. registration, title, firstname).
- Prefer placeholders :1, :2, … for user-supplied values and put matching entries in filterParams in order.
- filterParams[].value must always be a string (booleans as "true"/"false", dates as YYYY-MM-DD).
- Comparison operators: =, ==, #, !=, >, >=, <, <=, === / IS, !== / IS NOT, IN. Never invent operators.
- When the schema lists a relatedEntity (e.g. manager → Manager), filter with dotted paths: "manager.lastname = :1" with param "FOREY". Do NOT look up foreign-key IDs when a relation path works.

Wildcard "@" (critical):
- "@" is ONLY a wildcard character INSIDE string values. It is NEVER an operator between attribute and value.
- WRONG: registration @ :1   WRONG: name @ 'A'   WRONG: firstname@:1
- RIGHT starts-with A: filter "registration = :1" with filterParams [{"type":"string","value":"A@"}]
- RIGHT contains Smith: filter "lastName = :1" with value "@Smith@"
- RIGHT ends-with son: filter "lastName = :1" with value "@son"
- Example from docs: ds.Customer.query("firstName = :1";"S@") → filter "firstName = :1", param "S@"
- Example: "users starting with L" → filter "firstname = :1 OR lastname = :1", params [{"type":"string","value":"L@"}]
- Use === / IS only when "@" must be matched as a literal character (not as wildcard).

Other:
- Leave filter empty ("") only if the user asked for an unfiltered list with sort/select only.
- Leave sort/select empty when not requested.
- Do not invent attributes. Do not wrap the JSON in commentary.`

/** Fix LLM mistakes like \`attr @ :1\` + \`"A"\` → \`attr = :1\` + \`"A@"\`. */
export function normalizeWildcardFilterSyntax(options: QueryOptions): QueryOptions {
  const filterParams = options.filterParams.map((param) => ({ ...param }))
  const filter = options.filter.replace(
    /(\w+(?:\.\w+)*)\s*@\s*(:(\d+))/g,
    (_match, attribute: string, placeholder: string, indexText: string) => {
      const index = Number(indexText) - 1
      const param = filterParams[index]
      if (param?.type === 'string') {
        const value = param.value.trim()
        if (value && !value.includes('@')) {
          filterParams[index] = { ...param, value: `${value}@` }
        }
      }
      return `${attribute} = ${placeholder}`
    }
  )

  if (
    filter === options.filter &&
    filterParams.every((p, i) => p.value === options.filterParams[i]?.value)
  ) {
    return options
  }

  return { ...options, filter, filterParams }
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim()
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed
  const parsed = JSON.parse(jsonText) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('LLM returned invalid JSON object')
  }
  return parsed as Record<string, unknown>
}

function coerceFilterParam(raw: unknown): FilterParam | null {
  if (raw == null) return null
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return {
      type: typeof raw === 'number' ? 'number' : typeof raw === 'boolean' ? 'boolean' : 'string',
      value: String(raw),
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const typeRaw = typeof obj.type === 'string' ? obj.type : 'string'
  const type: FilterParamType = FILTER_PARAM_TYPES.has(typeRaw as FilterParamType)
    ? (typeRaw as FilterParamType)
    : 'string'
  if (obj.value == null) return { type, value: '' }
  if (typeof obj.value === 'object') {
    return { type: 'json', value: JSON.stringify(obj.value) }
  }
  return { type, value: String(obj.value) }
}

export function parseGeneratedQueryOptions(content: string): QueryOptions {
  const obj = parseJsonObject(content)
  const filterParamsRaw = obj.filterParams
  const filterParams: FilterParam[] = Array.isArray(filterParamsRaw)
    ? filterParamsRaw.map(coerceFilterParam).filter((p): p is FilterParam => p != null)
    : []

  const order = obj.order === 'desc' ? 'desc' : 'asc'

  return normalizeWildcardFilterSyntax(
    normalizeQueryOptions({
      filter: typeof obj.filter === 'string' ? obj.filter : '',
      filterParams,
      sort: typeof obj.sort === 'string' ? obj.sort : '',
      order,
      select: typeof obj.select === 'string' ? obj.select : '',
      top: typeof obj.top === 'number' ? obj.top : undefined,
    })
  )
}

function summarizeDataclassSchema(
  dataclassName: string,
  catalog: Awaited<ReturnType<typeof client.catalog.getAllWithMetadataCached>>
): string {
  const dc = catalog.dataClasses?.find((item) => item.name === dataclassName)
  if (!dc) {
    return `(Dataclass "${dataclassName}" not found in catalog.)`
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
    .map((attr) => {
      if (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities') {
        const relatedName = (attr.type || attr.path || 'unknown').trim()
        const bits = [`${attr.name}: ${attr.kind} → ${relatedName}`]
        if (attr.foreignKey) bits.push(`FK ${attr.foreignKey}`)
        return `- ${bits.join('; ')}`
      }
      const bits = [`${attr.name}: ${attr.type ?? 'unknown'}`]
      if (attr.kind && attr.kind !== 'storage') bits.push(`kind=${attr.kind}`)
      if (attr.readOnly) bits.push('readOnly')
      return `- ${bits.join(', ')}`
    })

  const keyNames = (dc.key ?? []).map((k) => k.name).filter(Boolean)
  const keyLine = keyNames.length > 0 ? `Primary key: ${keyNames.join(', ')}\n` : ''

  return `${keyLine}Attributes:\n${attrs.length > 0 ? attrs.join('\n') : '(no attributes)'}`
}

export async function generateQueryFromPrompt(input: {
  dataclassName: string
  prompt: string
  signal?: AbortSignal
}): Promise<QueryOptions> {
  if (!isAssistantLlmConfigured()) throw new Error('LLM not configured')

  const trimmed = input.prompt.trim()
  if (!trimmed) throw new Error('Prompt is required')

  const catalog = await client.catalog.getAllWithMetadataCached()
  const schemaSummary = summarizeDataclassSchema(input.dataclassName, catalog)

  const completion = await requestLlmCompletion({
    messages: [
      {
        role: 'user',
        content: [
          `Dataclass: ${input.dataclassName}`,
          '',
          schemaSummary,
          '',
          `User request: ${trimmed}`,
        ].join('\n'),
      },
    ],
    tools: [],
    systemPrompt: SYSTEM_PROMPT,
    signal: input.signal,
  })

  const text = completion.content?.trim()
  if (!text) throw new Error('LLM returned empty query')

  return parseGeneratedQueryOptions(text)
}
