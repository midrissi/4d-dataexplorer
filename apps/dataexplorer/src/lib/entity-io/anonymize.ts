import { mapWithConcurrency } from '~/lib/dataclass-counts'
import { getEnvFaker } from '~/lib/env/dynamic'
import { resolveEnvString } from '~/lib/env/runtime'
import { proposeFieldTemplateKeys } from '~/lib/env/suggest-field-templates'
import { isSystemEntityKey } from './helpers'
import type { EntityIoAttribute } from './types'

export type AnonymizeFieldMode = 'faker' | 'fixed' | 'keep' | 'empty'

export type AnonymizeFieldPlan = {
  name: string
  type?: string
  mode: AnonymizeFieldMode
  /** Template expression e.g. `{{$faker.person.firstName | lower}}`. */
  fakerKey?: string
  /** Literal replacement used when mode is fixed. */
  fixedValue?: string
}

const ANONYMIZE_FIELD_MODES = new Set<string>(['faker', 'fixed', 'keep', 'empty'])

function isAnonymizeFieldMode(value: unknown): value is AnonymizeFieldMode {
  return typeof value === 'string' && ANONYMIZE_FIELD_MODES.has(value)
}

/** Parse a JSON-compatible field plan before applying it to an anonymization run. */
export function parseAnonymizeFieldPlan(value: unknown): AnonymizeFieldPlan[] | null {
  if (!Array.isArray(value)) return null

  const names = new Set<string>()
  const plan: AnonymizeFieldPlan[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const field = item as Record<string, unknown>
    const name = typeof field.name === 'string' ? field.name.trim() : ''
    if (!name || names.has(name)) return null
    if (!isAnonymizeFieldMode(field.mode)) return null
    if (field.type !== undefined && typeof field.type !== 'string') return null
    if (field.fakerKey !== undefined && typeof field.fakerKey !== 'string') return null
    if (field.fixedValue !== undefined && typeof field.fixedValue !== 'string') return null

    names.add(name)
    plan.push({
      name,
      mode: field.mode,
      ...(typeof field.type === 'string' ? { type: field.type } : {}),
      ...(typeof field.fakerKey === 'string' ? { fakerKey: field.fakerKey } : {}),
      ...(typeof field.fixedValue === 'string' ? { fixedValue: field.fixedValue } : {}),
    })
  }
  return plan
}

/** Build a single default anonymization mapping for one attribute. */
export function buildAnonymizeFieldPlan(attr: EntityIoAttribute): AnonymizeFieldPlan {
  const keys = proposeFieldTemplateKeys({ name: attr.name, type: attr.type })
  const fakerKey = keys.find((k) => k.startsWith('$faker.')) ?? keys[0]
  if (fakerKey?.startsWith('$faker.') || fakerKey?.startsWith('$')) {
    return {
      name: attr.name,
      type: attr.type,
      mode: 'faker',
      fakerKey: `{{${fakerKey}}}`,
    }
  }
  const typeKey =
    attr.type === 'bool'
      ? '$faker.datatype.boolean'
      : attr.type === 'date'
        ? '$faker.date.past'
        : attr.type === 'object'
          ? '$faker.airline.airline'
          : isNumericType(attr.type)
            ? '$faker.number.int'
            : '$faker.lorem.word'
  return { name: attr.name, type: attr.type, mode: 'faker', fakerKey: `{{${typeKey}}}` }
}

/** Attributes that can appear in the anonymize field plan. */
export function listAnonymizeMappableAttributes(
  attrs: EntityIoAttribute[],
  primaryKey?: string
): EntityIoAttribute[] {
  return attrs.filter((a) => {
    if (a.kind === 'relatedEntity' || a.kind === 'relatedEntities') return false
    if (a.type === 'blob') return false
    if (a.kind && a.kind !== 'storage' && a.kind !== 'calculated' && a.kind !== 'alias')
      return false
    if (primaryKey && a.name === primaryKey) return false
    if (a.autosequence || a.readOnly) return false
    return true
  })
}

/** Build default anonymization plan from schema attributes. */
export function buildDefaultAnonymizePlan(
  attrs: EntityIoAttribute[],
  primaryKey?: string
): AnonymizeFieldPlan[] {
  return listAnonymizeMappableAttributes(attrs, primaryKey).map(buildAnonymizeFieldPlan)
}

function isNumericType(type: string): boolean {
  return ['byte', 'word', 'long', 'long64', 'number', 'real', 'float', 'duration'].includes(
    type.toLowerCase()
  )
}

export type AnonymizeOptions = {
  plan: AnonymizeFieldPlan[]
  /** Optional Faker seed for reproducible dumps. */
  seed?: number
  /** Named string lists for `{{$pick | from:$lists.<name>}}` (and sample/unique). */
  lists?: Record<string, readonly string[]>
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Anonymization cancelled', 'AbortError')
}

function coerceReplacement(original: unknown, replacement: string, fieldType?: string): unknown {
  if (typeof original === 'object' || fieldType?.toLowerCase() === 'object') {
    try {
      return JSON.parse(replacement) as unknown
    } catch {
      return replacement
    }
  }
  if (typeof original === 'boolean' || fieldType?.toLowerCase() === 'bool') {
    const normalized = replacement.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  if (typeof original === 'number' || (fieldType ? isNumericType(fieldType) : false)) {
    const number = Number(replacement)
    if (!Number.isNaN(number)) return number
  }
  return replacement
}

function asTemplate(expression: string): string {
  const trimmed = expression.trim()
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') ? trimmed : `{{${trimmed}}}`
}

/** Apply anonymization plan to a single entity (returns a new object). */
export function anonymizeEntity(
  entity: Record<string, unknown>,
  options: AnonymizeOptions
): Record<string, unknown> {
  if (options.seed != null) {
    getEnvFaker().seed(options.seed)
  }

  const out: Record<string, unknown> = { ...entity }
  for (const field of options.plan) {
    if (!(field.name in out) && field.mode === 'keep') continue
    if (field.mode === 'keep') continue
    if (field.mode === 'empty') {
      out[field.name] = null
      continue
    }
    const original = entity[field.name]
    if (field.mode === 'fixed') {
      out[field.name] = coerceReplacement(original, field.fixedValue ?? '', field.type)
      continue
    }
    const key = field.fakerKey
    if (!key) {
      out[field.name] = null
      continue
    }
    // Resolve against the in-progress entity so plan entries can consume values
    // generated by earlier entries while untouched fields retain their source value.
    const resolved = resolveEnvString(asTemplate(key), {
      this: out,
      lists: options.lists,
    })
    if (resolved.unresolved.length > 0) {
      out[field.name] = null
      continue
    }
    out[field.name] = coerceReplacement(original, resolved.text, field.type)
  }
  return out
}

/** Anonymize many entities. When seed is set, each row uses seed+index for uniqueness. */
export function anonymizeEntities(
  entities: Record<string, unknown>[],
  options: AnonymizeOptions
): Record<string, unknown>[] {
  return entities.map((entity, index) =>
    anonymizeEntity(entity, {
      plan: options.plan,
      seed: options.seed != null ? options.seed + index : undefined,
      lists: options.lists,
    })
  )
}

/** Anonymize in chunks so callers can render progress for large selections. */
export async function anonymizeEntitiesWithProgress(
  entities: Record<string, unknown>[],
  options: AnonymizeOptions,
  onProgress: (processed: number, total: number) => void,
  chunkSize = 100,
  signal?: AbortSignal
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let start = 0; start < entities.length; start += chunkSize) {
    throwIfAborted(signal)
    const chunk = entities.slice(start, start + chunkSize)
    out.push(
      ...chunk.map((entity, index) =>
        anonymizeEntity(entity, {
          plan: options.plan,
          seed: options.seed != null ? options.seed + start + index : undefined,
          lists: options.lists,
        })
      )
    )
    onProgress(out.length, entities.length)
    if (start + chunk.length < entities.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  return out
}

function imageFilename(url: string, contentType: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop()
    if (name?.includes('.')) return name
  } catch {
    // Use the MIME-derived fallback below.
  }
  const extension = contentType.split('/')[1]?.split('+')[0] || 'png'
  return `anonymized-image.${extension}`
}

/** True when a plan entry generates a remote image for a 4D Image attribute. */
export function isImageAnonymizeField(field: AnonymizeFieldPlan): boolean {
  return field.type?.toLowerCase() === 'image' && field.mode === 'faker'
}

/** Limit concurrent remote fetches and 4D `$upload` calls per anonymization run. */
export const IMAGE_UPLOAD_CONCURRENCY = 6

/**
 * Replace generated image URLs with 4D `$upload` IDs before entities are exported or written.
 * Uploads run with bounded concurrency to avoid serial network latency while protecting the
 * connected 4D server from an unbounded burst of `$upload` requests.
 */
export async function uploadAnonymizedImages(
  entities: Record<string, unknown>[],
  plan: readonly AnonymizeFieldPlan[],
  uploadImage: (file: File) => Promise<{ ID: string }>,
  onProgress: (uploaded: number, total: number) => void,
  fetchImage: (url: string, signal?: AbortSignal) => Promise<Response> = (url, signal) =>
    fetch(url, { signal }),
  concurrency = IMAGE_UPLOAD_CONCURRENCY,
  signal?: AbortSignal
): Promise<Record<string, unknown>[]> {
  const imageFields = plan.filter(isImageAnonymizeField)
  const total = entities.length * imageFields.length
  if (total === 0) return entities

  let uploaded = 0
  const jobs = entities.flatMap((entity) => imageFields.map((field) => ({ entity, field })))
  await mapWithConcurrency(jobs, concurrency, async ({ entity, field }) => {
    throwIfAborted(signal)
    const url = entity[field.name]
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error(`Image template for ${field.name} did not produce a URL`)
    }
    const response = await fetchImage(url, signal)
    if (!response.ok) throw new Error(`Could not fetch generated image: ${response.status}`)
    const blob = await response.blob()
    throwIfAborted(signal)
    const contentType = blob.type || response.headers.get('content-type') || 'image/png'
    const file = new File([blob], imageFilename(url, contentType), { type: contentType })
    const result = await uploadImage(file)
    entity[field.name] = { ID: result.ID }
    uploaded += 1
    onProgress(uploaded, total)
  })
  return entities
}

/** Keep optimistic-lock keys and only fields changed by the anonymization plan. */
export function prepareAnonymizedUpdate(
  entity: Record<string, unknown>,
  plan: AnonymizeFieldPlan[]
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    __KEY: entity.__KEY,
    __STAMP: entity.__STAMP,
  }
  for (const field of plan) {
    if (field.mode !== 'keep') update[field.name] = entity[field.name]
  }
  return update
}

/**
 * Strip system + PK fields for create/download after anonymize.
 * When `plan` is provided, only mapped fields are kept (removed rows are omitted).
 */
export function stripForCreate(
  entity: Record<string, unknown>,
  primaryKey?: string,
  plan?: AnonymizeFieldPlan[]
): Record<string, unknown> {
  if (plan) {
    const out: Record<string, unknown> = {}
    for (const field of plan) {
      if (primaryKey && field.name === primaryKey) continue
      if (isSystemEntityKey(field.name)) continue
      out[field.name] = entity[field.name]
    }
    return out
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (isSystemEntityKey(key)) continue
    if (primaryKey && key === primaryKey) continue
    out[key] = value
  }
  return out
}
