import type { RuntimeArgument } from '~/store/method-executor-types'

export const ARGUMENT_KINDS = [
  'string',
  'number',
  'boolean',
  'date',
  'custom',
  'entity',
  'entitysel',
] as const satisfies ReadonlyArray<RuntimeArgument['kind']>

export type RuntimeArgumentNamePrefix = '$' | ':'

export function withPositionalNames(
  argumentsList: RuntimeArgument[],
  namePrefix: RuntimeArgumentNamePrefix = '$'
): RuntimeArgument[] {
  return argumentsList.map((argument, index) => ({
    ...argument,
    name: `${namePrefix}${index + 1}`,
  }))
}

export function areRuntimeArgumentsReady(argumentsList: RuntimeArgument[]): boolean {
  return argumentsList.every((argument) => {
    if (argument.kind === 'entity') {
      return Boolean(argument.dataClass.trim() && argument.key.trim())
    }
    if (argument.kind === 'entitysel') {
      return Boolean(argument.dataClass.trim() && argument.entitySetId.trim())
    }
    if (argument.kind === 'number') {
      const trimmed = argument.value.trim()
      return trimmed !== '' && Number.isFinite(Number(trimmed))
    }
    if (argument.kind === 'date') {
      return /^\d{4}-\d{2}-\d{2}$/.test(argument.value.trim())
    }
    return true
  })
}

function argumentValueAsText(argument: RuntimeArgument): string {
  switch (argument.kind) {
    case 'string':
    case 'number':
    case 'date':
    case 'custom':
      return argument.value
    case 'boolean':
      return argument.value ? 'true' : 'false'
    case 'entity':
      return argument.key
    case 'entitysel':
      return argument.entitySetId
  }
}

function parseBooleanText(raw: string): boolean | null {
  const lower = raw.trim().toLowerCase()
  if (!lower) return null
  if (['true', '1', 'yes', 'y'].includes(lower)) return true
  if (['false', '0', 'no', 'n'].includes(lower)) return false
  const n = Number(lower)
  if (Number.isFinite(n)) return n !== 0
  return null
}

function parseNumberText(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === 'true') return '1'
  if (lower === 'false') return '0'
  const n = Number(trimmed)
  if (Number.isFinite(n)) return String(n)
  return null
}

function parseDateText(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

function parseCustomText(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'null'
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    return JSON.stringify(trimmed)
  }
}

/** Switch kind, converting the existing value when possible instead of resetting. */
export function changeRuntimeArgumentKind(
  argument: RuntimeArgument,
  kind: RuntimeArgument['kind']
): RuntimeArgument {
  const common = { id: argument.id, name: argument.name, sourceType: argument.sourceType }
  if (argument.kind === kind) return argument

  const text = argumentValueAsText(argument)

  if (kind === 'entity') {
    return { ...common, kind, dataClass: '', key: text.trim() }
  }
  if (kind === 'entitysel') {
    return { ...common, kind, dataClass: '', entitySetId: text.trim() }
  }
  if (kind === 'boolean') {
    return { ...common, kind, value: parseBooleanText(text) ?? false }
  }
  if (kind === 'number') {
    return { ...common, kind, value: parseNumberText(text) ?? '0' }
  }
  if (kind === 'string') {
    return { ...common, kind, value: text }
  }
  if (kind === 'date') {
    return { ...common, kind, value: parseDateText(text) ?? '' }
  }
  return { ...common, kind: 'custom', value: parseCustomText(text) }
}

export function emptyArgument(
  index: number,
  namePrefix: RuntimeArgumentNamePrefix,
  kind: RuntimeArgument['kind'] = 'string'
): RuntimeArgument {
  return changeRuntimeArgumentKind(
    { id: crypto.randomUUID(), kind: 'string', name: `${namePrefix}${index}`, value: '' },
    kind
  )
}

export function duplicateArgument(argument: RuntimeArgument): RuntimeArgument {
  return { ...argument, id: crypto.randomUUID() }
}

export function kindLabel(kind: RuntimeArgument['kind'], t: (key: string) => string): string {
  switch (kind) {
    case 'string':
      return t('methodExecutor.string')
    case 'number':
      return t('methodExecutor.number')
    case 'boolean':
      return t('methodExecutor.boolean')
    case 'date':
      return t('methodExecutor.date')
    case 'custom':
      return t('methodExecutor.custom')
    case 'entity':
      return t('methodExecutor.entity')
    case 'entitysel':
      return t('methodExecutor.entitySelection')
  }
}
