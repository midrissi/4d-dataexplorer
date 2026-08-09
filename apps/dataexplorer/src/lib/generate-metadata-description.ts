import type { CatalogWithMetadataExpanded } from '@4d/rest'
import { requestLlmCompletion } from '@4djs/assistant/core'
import type { MethodArgumentSchema } from '@4djs/assistant/tools'
import { filterAssistantExposedMethods } from './assistant-exposed-method'
import { assertCloudLlmAvailable } from './assistant-llm-configured'

const DESCRIPTION_SYSTEM_PROMPT = `You write concise, helpful documentation for a 4D database REST API assistant.
Return ONLY the description text — no quotes, markdown, or JSON wrapper.
Keep descriptions to 1-3 sentences. Focus on purpose and usage for developers querying the datastore.`

const ARGUMENTS_SYSTEM_PROMPT = `You generate JSON Schema (draft 2020-12) describing positional method parameters for a 4D REST API.
Return ONLY valid JSON with this shape:
{
  "arguments": [
    { "type": "string", "description": "..." },
    { "type": "integer", "minimum": 1 }
  ]
}
4D REST passes parameters as a JSON array in order. Each entry in "arguments" is one positional parameter schema for the method itself only.
For entity methods (applyTo: entity), do NOT include the entity primary key — the assistant prepends it automatically.
For entity selection methods (applyTo: entitySelection, entityCollection, or dataClassSelection), do NOT include the entity set ID or filter — the assistant prepends it automatically.
Use appropriate types (string, integer, number, boolean, object, array). Add "description" on each argument when helpful.
If the method has no parameters, return: { "arguments": [] }`

type Catalog = CatalogWithMetadataExpanded

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

async function completeDescription(userContent: string, signal?: AbortSignal): Promise<string> {
  const completion = await requestLlmCompletion({
    messages: [{ role: 'user', content: userContent }],
    tools: [],
    systemPrompt: DESCRIPTION_SYSTEM_PROMPT,
    signal,
  })
  const text = completion.content?.trim()
  if (!text) throw new Error('LLM returned empty description')
  return text.replace(/^["']|["']$/g, '')
}

export async function generateDataclassDescription(input: {
  catalog: Catalog
  dataclassName: string
  signal?: AbortSignal
}): Promise<string> {
  assertCloudLlmAvailable()

  const dc = input.catalog.dataClasses.find((d) => d.name === input.dataclassName)
  if (!dc) throw new Error(`Dataclass not found: ${input.dataclassName}`)

  return completeDescription(
    [
      `Write a description for dataclass "${dc.name}" (collection: ${dc.collectionName}).`,
      '',
      'Attributes:',
      JSON.stringify(
        (dc.attributes ?? []).map((a) => ({
          name: a.name,
          type: a.type,
          kind: a.kind,
          indexed: a.indexed,
          unique: a.unique,
        })),
        null,
        2
      ),
      '',
      'Methods:',
      JSON.stringify(
        filterAssistantExposedMethods(dc.methods).map((m) => ({
          name: m.name,
          applyTo: m.applyTo,
          paramsText: m.paramsText,
        })),
        null,
        2
      ),
    ].join('\n'),
    input.signal
  )
}

export async function generateAttributeDescription(input: {
  catalog: Catalog
  dataclassName: string
  attributeName: string
  signal?: AbortSignal
}): Promise<string> {
  assertCloudLlmAvailable()

  const dc = input.catalog.dataClasses.find((d) => d.name === input.dataclassName)
  const attr = dc?.attributes?.find((a) => a.name === input.attributeName)
  if (!dc || !attr) throw new Error('Attribute not found')

  return completeDescription(
    [
      `Write a description for attribute "${attr.name}" on dataclass "${dc.name}".`,
      '',
      'Attribute metadata:',
      JSON.stringify(attr, null, 2),
    ].join('\n'),
    input.signal
  )
}

export async function generateSingletonDescription(input: {
  catalog: Catalog
  singletonName: string
  signal?: AbortSignal
}): Promise<string> {
  assertCloudLlmAvailable()

  const singleton = input.catalog.singletons?.find((s) => s.name === input.singletonName)
  if (!singleton) throw new Error(`Singleton not found: ${input.singletonName}`)

  return completeDescription(
    [
      `Write a description for singleton "${singleton.name}".`,
      '',
      'Methods:',
      JSON.stringify(
        filterAssistantExposedMethods(singleton.methods).map((m) => ({
          name: m.name,
          paramsText: m.paramsText,
          exposed: m.exposed,
        })),
        null,
        2
      ),
    ].join('\n'),
    input.signal
  )
}

export async function generateMethodDescription(input: {
  catalog: Catalog
  context: 'dataclass' | 'singleton' | 'catalog'
  ownerName: string
  methodName: string
  signal?: AbortSignal
}): Promise<string> {
  assertCloudLlmAvailable()

  let methodInfo: Record<string, unknown> | null = null

  if (input.context === 'dataclass') {
    const dc = input.catalog.dataClasses.find((d) => d.name === input.ownerName)
    const method = dc?.methods?.find((m) => m.name === input.methodName)
    if (!method) throw new Error('Method not found')
    methodInfo = { ...method, dataclass: input.ownerName }
  } else if (input.context === 'singleton') {
    const singleton = input.catalog.singletons?.find((s) => s.name === input.ownerName)
    const method = singleton?.methods?.find((m) => m.name === input.methodName)
    if (!method) throw new Error('Method not found')
    methodInfo = { ...method, singleton: input.ownerName }
  } else {
    const method = input.catalog.methods?.find((m) => m.name === input.methodName)
    if (!method) throw new Error('Method not found')
    methodInfo = { ...method, catalogMethod: true }
  }

  return completeDescription(
    [
      `Write a description for method "${input.methodName}" (${input.context}: ${input.ownerName}).`,
      '',
      'Method metadata:',
      JSON.stringify(methodInfo, null, 2),
    ].join('\n'),
    input.signal
  )
}

export async function generateMethodArguments(input: {
  catalog: Catalog
  context: 'dataclass' | 'singleton' | 'catalog'
  ownerName: string
  methodName: string
  signal?: AbortSignal
}): Promise<MethodArgumentSchema[]> {
  assertCloudLlmAvailable()

  let methodInfo: Record<string, unknown> | null = null

  if (input.context === 'dataclass') {
    const dc = input.catalog.dataClasses.find((d) => d.name === input.ownerName)
    const method = dc?.methods?.find((m) => m.name === input.methodName)
    if (!method) throw new Error('Method not found')
    methodInfo = { ...method, dataclass: input.ownerName }
  } else if (input.context === 'singleton') {
    const singleton = input.catalog.singletons?.find((s) => s.name === input.ownerName)
    const method = singleton?.methods?.find((m) => m.name === input.methodName)
    if (!method) throw new Error('Method not found')
    methodInfo = { ...method, singleton: input.ownerName }
  } else {
    const method = input.catalog.methods?.find((m) => m.name === input.methodName)
    if (!method) throw new Error('Method not found')
    methodInfo = { ...method, catalogMethod: true }
  }

  const completion = await requestLlmCompletion({
    messages: [
      {
        role: 'user',
        content: [
          `Generate positional parameter schemas for method "${input.methodName}" (${input.context}: ${input.ownerName}).`,
          '',
          'Method metadata:',
          JSON.stringify(methodInfo, null, 2),
        ].join('\n'),
      },
    ],
    tools: [],
    systemPrompt: ARGUMENTS_SYSTEM_PROMPT,
    responseFormat: { type: 'json_object' },
    signal: input.signal,
  })

  const parsed = parseJsonObject(completion.content ?? '')
  const args = parsed.arguments
  if (!Array.isArray(args)) {
    throw new Error('LLM returned invalid arguments array')
  }
  return args.filter(
    (entry): entry is MethodArgumentSchema =>
      !!entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      typeof (entry as MethodArgumentSchema).type === 'string'
  )
}

/** @deprecated Use generateMethodArguments */
export async function generateMethodParamsSchema(input: {
  catalog: Catalog
  context: 'dataclass' | 'singleton' | 'catalog'
  ownerName: string
  methodName: string
  signal?: AbortSignal
}): Promise<Record<string, unknown>> {
  const arguments_ = await generateMethodArguments(input)
  return { arguments: arguments_ }
}
