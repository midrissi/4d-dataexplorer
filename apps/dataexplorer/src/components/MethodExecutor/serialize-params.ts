import { resolveEnvTemplates } from '~/lib/env'
import { getActiveEnvMap } from '~/lib/env/runtime'
import type { RuntimeArgument } from '~/store/method-executor-types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Convert an ISO calendar date to the 4D REST date literal `!!YYYY-MM-DD!!`. */
export function to4DDateLiteral(isoDate: string): string {
  const trimmed = isoDate.trim()
  if (!ISO_DATE.test(trimmed)) {
    throw new Error('date must be YYYY-MM-DD')
  }
  return `!!${trimmed}!!`
}

/** Resolve `{{var}}` in string-like argument fields before serialize/send. */
export function resolveRuntimeArgumentsEnv(argumentsList: RuntimeArgument[]): {
  argumentsList: RuntimeArgument[]
  unresolved: string[]
} {
  const map = getActiveEnvMap()
  const unresolved: string[] = []
  const push = (keys: string[]) => {
    for (const key of keys) {
      if (!unresolved.includes(key)) unresolved.push(key)
    }
  }

  const resolved = argumentsList.map((argument) => {
    if (argument.kind === 'string' || argument.kind === 'number' || argument.kind === 'date') {
      const value = resolveEnvTemplates(argument.value, map)
      push(value.unresolved)
      return { ...argument, value: value.text }
    }
    if (argument.kind === 'custom') {
      const value = resolveEnvTemplates(argument.value, map)
      push(value.unresolved)
      return { ...argument, value: value.text }
    }
    if (argument.kind === 'entity') {
      const dataClass = resolveEnvTemplates(argument.dataClass, map)
      const key = resolveEnvTemplates(argument.key, map)
      push(dataClass.unresolved)
      push(key.unresolved)
      return { ...argument, dataClass: dataClass.text, key: key.text }
    }
    if (argument.kind === 'entitysel') {
      const entitySetId = resolveEnvTemplates(argument.entitySetId, map)
      push(entitySetId.unresolved)
      return { ...argument, entitySetId: entitySetId.text }
    }
    return argument
  })

  return { argumentsList: resolved, unresolved }
}

export function serializeRuntimeParams(argumentsList: RuntimeArgument[]): unknown[] {
  return argumentsList.map((argument, index) => {
    const label = argument.name || `#${index + 1}`
    if (argument.kind === 'entity') {
      if (!argument.dataClass.trim() || !argument.key.trim()) {
        throw new Error(`${label}: dataclass and entity key are required`)
      }
      return {
        __DATACLASS: argument.dataClass.trim(),
        __ENTITY: true,
        __KEY: argument.key.trim(),
      }
    }
    if (argument.kind === 'entitysel') {
      if (!argument.entitySetId.trim()) {
        throw new Error(`${label}: entity set ID is required`)
      }
      return {
        __ENTITIES: true,
        __DATASET: argument.entitySetId.trim(),
      }
    }
    if (argument.kind === 'string') {
      return argument.value
    }
    if (argument.kind === 'boolean') {
      return argument.value
    }
    if (argument.kind === 'number') {
      const trimmed = argument.value.trim()
      if (!trimmed) {
        throw new Error(`${label}: number is required`)
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) {
        throw new Error(`${label}: value must be a valid number`)
      }
      return parsed
    }
    if (argument.kind === 'date') {
      const trimmed = argument.value.trim()
      if (!trimmed) {
        throw new Error(`${label}: date is required`)
      }
      try {
        return to4DDateLiteral(trimmed)
      } catch {
        throw new Error(`${label}: date must be YYYY-MM-DD`)
      }
    }
    try {
      return JSON.parse(argument.value)
    } catch {
      throw new Error(`${label}: value must be valid JSON`)
    }
  })
}
