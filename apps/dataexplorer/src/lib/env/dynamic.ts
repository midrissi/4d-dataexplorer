/**
 * Dynamic template variables (`{{$timestamp}}`, `{{$faker.person.fullName}}`, …).
 *
 * Powered by `@faker-js/faker` (English locale). Values are generated at resolve time.
 * User-defined env vars with the same key win.
 * Optional Liquid-style filters pass {@link DynamicGenerateOptions} (gender, ranges, …).
 */

import { fakerEN as faker } from '@faker-js/faker'

export type DynamicGenerateOptions = {
  gender?: 'female' | 'male'
  min?: number
  max?: number
  /** Inclusive lower calendar bound `YYYY-MM-DD`. */
  after?: string
  /** Inclusive upper calendar bound `YYYY-MM-DD`. */
  before?: string
}

export type DynamicEnvVarDef = {
  /** Key including leading `$` (e.g. `$timestamp`). */
  key: string
  /** Short description for completions / help. */
  description: string
  generate: (options?: DynamicGenerateOptions) => string
}

const FAKER_PATH_RE = /^\$faker\.([a-zA-Z]\w*)\.([a-zA-Z]\w*)$/

/** Faker modules exposed via `{{$faker.module.method}}`. */
const FAKER_MODULES = [
  'airline',
  'animal',
  'book',
  'color',
  'commerce',
  'company',
  'database',
  'datatype',
  'date',
  'finance',
  'food',
  'git',
  'hacker',
  'helpers',
  'image',
  'internet',
  'location',
  'lorem',
  'music',
  'number',
  'person',
  'phone',
  'science',
  'string',
  'system',
  'vehicle',
  'word',
] as const

type FakerModuleName = (typeof FAKER_MODULES)[number]

function def(
  key: string,
  description: string,
  generate: (options?: DynamicGenerateOptions) => string
): DynamicEnvVarDef {
  return { key, description, generate }
}

function resolveIntRange(
  options: DynamicGenerateOptions | undefined,
  defaultMin: number,
  defaultMax: number
): { min: number; max: number } {
  let min = options?.min ?? defaultMin
  let max = options?.max ?? defaultMax
  if (min > max) {
    const tmp = min
    min = max
    max = tmp
  }
  return { min, max }
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateBounds(options?: DynamicGenerateOptions): { from: Date; to: Date } {
  const defaultFrom = new Date(Date.now() - 365 * 40 * 86_400_000)
  const defaultTo = new Date()
  let from = options?.after ? (parseDateOnly(options.after) ?? defaultFrom) : defaultFrom
  let to = options?.before ? (parseDateOnly(options.before) ?? defaultTo) : defaultTo
  if (from.getTime() > to.getTime()) {
    const tmp = from
    from = to
    to = tmp
  }
  return { from, to }
}

function sexOf(options?: DynamicGenerateOptions): 'female' | 'male' | undefined {
  return options?.gender
}

function stringifyFakerResult(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

function listModuleMethods(moduleValue: object): string[] {
  const names = new Set<string>()
  for (const name of Object.keys(moduleValue)) {
    if (name.startsWith('_')) continue
    if (typeof (moduleValue as Record<string, unknown>)[name] === 'function') names.add(name)
  }
  let proto: object | null = Object.getPrototypeOf(moduleValue)
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor' || name.startsWith('_')) continue
      if (typeof (moduleValue as Record<string, unknown>)[name] === 'function') names.add(name)
    }
    proto = Object.getPrototypeOf(proto)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

function getFakerModule(moduleName: string): object | undefined {
  if (!(FAKER_MODULES as readonly string[]).includes(moduleName)) return undefined
  const value = (faker as unknown as Record<string, unknown>)[moduleName]
  return value && typeof value === 'object' ? (value as object) : undefined
}

function getFakerMethod(
  moduleName: string,
  methodName: string
): ((...args: unknown[]) => unknown) | undefined {
  const mod = getFakerModule(moduleName)
  if (!mod) return undefined
  const fn = (mod as Record<string, unknown>)[methodName]
  return typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown).bind(mod) : undefined
}

function buildFakerCallArgs(
  moduleName: string,
  methodName: string,
  options?: DynamicGenerateOptions
): unknown[] {
  if (!options) return []

  const sex = sexOf(options)
  if (sex) {
    if (moduleName === 'person') {
      if (methodName === 'firstName' || methodName === 'middleName' || methodName === 'prefix') {
        return [sex]
      }
      if (methodName === 'fullName') return [{ sex }]
    }
    if (moduleName === 'internet') {
      if (
        methodName === 'email' ||
        methodName === 'exampleEmail' ||
        methodName === 'username' ||
        methodName === 'displayName'
      ) {
        const firstName = faker.person.firstName(sex)
        return [{ firstName }]
      }
    }
  }

  if (options.min != null || options.max != null) {
    const { min, max } = resolveIntRange(options, 0, 1000)
    if (
      moduleName === 'number' ||
      methodName === 'int' ||
      methodName === 'float' ||
      methodName === 'bigInt' ||
      methodName === 'price' ||
      methodName === 'amount'
    ) {
      return [{ min, max }]
    }
  }

  if (options.after != null || options.before != null) {
    if (moduleName === 'date' && (methodName === 'between' || methodName === 'betweens')) {
      const { from, to } = dateBounds(options)
      return [{ from, to }]
    }
  }

  return []
}

function callFakerMethod(
  fn: (...args: unknown[]) => unknown,
  args: unknown[]
): unknown | undefined {
  try {
    return fn(...args)
  } catch {
    if (args.length === 0) return undefined
    try {
      return fn()
    } catch {
      return undefined
    }
  }
}

/** Invoke `{{$faker.module.method}}` with optional generator filters. */
export function invokeFakerPath(key: string, options?: DynamicGenerateOptions): string | undefined {
  const match = FAKER_PATH_RE.exec(key.trim())
  if (!match) return undefined
  const moduleName = match[1] ?? ''
  const methodName = match[2] ?? ''
  const fn = getFakerMethod(moduleName, methodName)
  if (!fn) return undefined
  const args = buildFakerCallArgs(moduleName, methodName, options)
  return stringifyFakerResult(callFakerMethod(fn, args))
}

export function isFakerPathKey(key: string): boolean {
  const match = FAKER_PATH_RE.exec(key.trim())
  if (!match) return false
  return Boolean(getFakerMethod(match[1] ?? '', match[2] ?? ''))
}

function enumerateFakerPathDefs(): DynamicEnvVarDef[] {
  const defs: DynamicEnvVarDef[] = []
  for (const moduleName of FAKER_MODULES) {
    const mod = getFakerModule(moduleName)
    if (!mod) continue
    for (const methodName of listModuleMethods(mod)) {
      const key = `$faker.${moduleName}.${methodName}`
      defs.push(
        def(key, `Faker ${moduleName}.${methodName}`, (options) => {
          return invokeFakerPath(key, options) ?? ''
        })
      )
    }
  }
  return defs
}

let fakerPathDefsCache: readonly DynamicEnvVarDef[] | undefined

function getFakerPathDefs(): readonly DynamicEnvVarDef[] {
  if (!fakerPathDefsCache) fakerPathDefsCache = enumerateFakerPathDefs()
  return fakerPathDefsCache
}

/**
 * Built-in aliases that are not Faker methods (wall-clock values).
 * Prefer `{{$faker.module.method}}` for generated data (e.g. `$faker.person.firstName`).
 */
export const DYNAMIC_ENV_VARS: readonly DynamicEnvVarDef[] = [
  def('$timestamp', 'Current UNIX timestamp in seconds', () =>
    String(Math.floor(Date.now() / 1000))
  ),
  def('$isoTimestamp', 'Current ISO timestamp at zero UTC', () => new Date().toISOString()),
]

const ALIAS_BY_KEY = new Map(DYNAMIC_ENV_VARS.map((item) => [item.key, item]))

/** Alias defs plus every `$faker.module.method` completion entry. */
export function listAllDynamicEnvVarDefs(): readonly DynamicEnvVarDef[] {
  return [...DYNAMIC_ENV_VARS, ...getFakerPathDefs()]
}

/** Ergonomic helper keys for completions (`$pick`, `$object`, …). */
export function listHelperTemplateKeys(): string[] {
  // Imported lazily via re-export from template-helpers in index — avoid cycle by listing here.
  return ['$pick', '$sample', '$unique', '$repeat', '$object', '$vector']
}

/** True when `key` is a known dynamic variable (alias or Faker path). */
export function isDynamicEnvVar(key: string): boolean {
  const trimmed = key.trim()
  return ALIAS_BY_KEY.has(trimmed) || isFakerPathKey(trimmed)
}

/** Generate a fresh value for a dynamic variable, or `undefined` if unknown. */
export function resolveDynamicEnvVar(
  key: string,
  options?: DynamicGenerateOptions
): string | undefined {
  const trimmed = key.trim()
  const alias = ALIAS_BY_KEY.get(trimmed)
  if (alias) {
    try {
      return alias.generate(options)
    } catch {
      return undefined
    }
  }
  return invokeFakerPath(trimmed, options)
}

/** Keys for completions / help (aliases first, then `$faker.*` paths). */
export function listDynamicEnvVarKeys(): string[] {
  return listAllDynamicEnvVarDefs().map((item) => item.key)
}

export function getDynamicEnvVarDescription(key: string): string | undefined {
  const trimmed = key.trim()
  const alias = ALIAS_BY_KEY.get(trimmed)
  if (alias) return alias.description
  const match = FAKER_PATH_RE.exec(trimmed)
  if (!match) return undefined
  const moduleName = match[1] ?? ''
  const methodName = match[2] ?? ''
  if (!getFakerMethod(moduleName, methodName)) return undefined
  return `Faker ${moduleName}.${methodName}`
}

/** Shared Faker instance (English) for template dynamics and the terminal `faker` binding. */
export function getEnvFaker(): typeof faker {
  return faker
}

/** Faker module names available on `faker.*` / `{{$faker.*}}`. */
export function listFakerModules(): readonly FakerModuleName[] {
  return FAKER_MODULES
}

/** Method names on a Faker module (e.g. `person` → `firstName`, `fullName`, …). */
export function listFakerModuleMethods(moduleName: string): string[] {
  const mod = getFakerModule(moduleName)
  if (!mod) return []
  return listModuleMethods(mod)
}

/** @internal Exported for tests — Faker module names used by the path API. */
export const __FAKER_MODULES_FOR_TEST = FAKER_MODULES as readonly FakerModuleName[]
