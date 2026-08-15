import { getEnvFaker, resolveDynamicEnvVar } from '~/lib/env/dynamic'
import { proposeFieldTemplateKeys } from '~/lib/env/suggest-field-templates'
import { analyzableAttributes, isSystemEntityKey } from './helpers'
import type { EntityIoAttribute } from './types'

export type AnonymizeFieldMode = 'faker' | 'keep' | 'empty'

export type AnonymizeFieldPlan = {
  name: string
  mode: AnonymizeFieldMode
  /** Dynamic env key e.g. `$faker.person.firstName` when mode is faker. */
  fakerKey?: string
}

/** Build default anonymization plan from schema attributes. */
export function buildDefaultAnonymizePlan(
  attrs: EntityIoAttribute[],
  primaryKey?: string
): AnonymizeFieldPlan[] {
  const storage = analyzableAttributes(attrs).filter((a) => {
    if (primaryKey && a.name === primaryKey) return false
    if (a.autosequence || a.readOnly) return false
    return true
  })

  return storage.map((attr) => {
    const keys = proposeFieldTemplateKeys({ name: attr.name, type: attr.type })
    const fakerKey = keys.find((k) => k.startsWith('$faker.')) ?? keys[0]
    if (fakerKey?.startsWith('$faker.') || fakerKey?.startsWith('$')) {
      return { name: attr.name, mode: 'faker' as const, fakerKey }
    }
    // Fallback by type
    const typeKey =
      attr.type === 'bool'
        ? '$faker.datatype.boolean'
        : attr.type === 'date'
          ? '$faker.date.past'
          : isNumericType(attr.type)
            ? '$faker.number.int'
            : '$faker.lorem.word'
    return { name: attr.name, mode: 'faker' as const, fakerKey: typeKey }
  })
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
    const key = field.fakerKey
    if (!key) {
      out[field.name] = null
      continue
    }
    const generated = resolveDynamicEnvVar(key)
    if (generated === undefined) {
      out[field.name] = null
      continue
    }
    // Coerce boolean / number-ish strings when the original looked typed
    const original = entity[field.name]
    if (typeof original === 'boolean') {
      out[field.name] = generated === 'true' || generated === '1'
    } else if (typeof original === 'number') {
      const n = Number(generated)
      out[field.name] = Number.isNaN(n) ? generated : n
    } else {
      out[field.name] = generated
    }
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
    })
  )
}

/** Strip system + PK fields for create-as-new import after anonymize. */
export function stripForCreate(
  entity: Record<string, unknown>,
  primaryKey?: string
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (isSystemEntityKey(key)) continue
    if (primaryKey && key === primaryKey) continue
    out[key] = value
  }
  return out
}
