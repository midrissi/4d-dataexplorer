import {
  createHttpId,
  type HttpBodyState,
  type HttpClientNetworkErrorInfo,
  type HttpClientResponse,
  type HttpClientSeed,
  type HttpClientSettings,
  type HttpFormDataField,
  type HttpKeyValuePair,
  type HttpMethod,
  type HttpResponseCookie,
  type HttpTargetMode,
  normalizeHttpBody,
  normalizeHttpSettings,
} from '~/store/http-client-types'
import { consoleService } from './console'
import { downloadBytes } from './download-bytes'
import { resolveEnvTemplates } from './env'
import { buildHttpThis } from './env/this-context-builders'
import { getActiveEnvMap, mergeUnresolved } from './env/runtime'
import {
  getBaseUrl,
  getCookies,
  getCustomHeaders,
  getLoggingFetch,
  getSkipSSL,
  getTimeout,
  isDesktop,
} from './platform'

export type HttpClientRequestDraft = {
  method: HttpMethod
  customMethod: string
  targetMode: HttpTargetMode
  customOrigin: string
  path: string
  params: HttpKeyValuePair[]
  headers: HttpKeyValuePair[]
  body: HttpBodyState
  settings: HttpClientSettings
  /**
   * Lowercase built-in / transport header names the user unchecked for this request
   * (e.g. `user-agent`, `origin`, `cookie`).
   */
  disabledBuiltInHeaders: string[]
}

/** Desktop User-Agent: `dataexplorer/<app version>`. */
export function getDesktopHttpUserAgent(): string {
  let version = '0.0.0'
  try {
    // Vite injects `__APP_VERSION__` at build time; Bun tests may leave it unbound.
    const injected = __APP_VERSION__
    if (typeof injected === 'string' && injected.trim()) version = injected.trim()
  } catch {
    // keep fallback
  }
  return `dataexplorer/${version}`
}

/** @deprecated Prefer {@link getDesktopHttpUserAgent}. */
export const DESKTOP_HTTP_USER_AGENT = getDesktopHttpUserAgent()

export const DESKTOP_HTTP_ACCEPT = '*/*'

export type HttpBuiltInHeaderSource =
  | 'connection'
  | 'cookie'
  | 'user-agent'
  | 'origin'
  | 'accept'
  | 'host'
  | 'content-length'

export type HttpBuiltInHeader = {
  key: string
  value: string
  source: HttpBuiltInHeaderSource
  enabled: boolean
  /** True when an enabled user header already defines this name. */
  overridden: boolean
  editable: boolean
}

export type BuiltHttpRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: BodyInit | undefined
  settings: HttpClientSettings
  /** True when targeting the currently connected server origin. */
  isCurrentServer: boolean
  /** Env variable keys that were referenced but not resolved. */
  unresolvedEnvKeys?: string[]
}

export type HttpClientFetchOptions = {
  sendCookies?: boolean
  connectTimeout?: number
  maxRedirections?: number
  skipSsl?: boolean
  credentials?: RequestCredentials
}

const REDACTED = '[REDACTED]'

/** Common request header names for autocomplete. */
export const COMMON_REQUEST_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'If-Match',
  'If-None-Match',
  'Origin',
  'Referer',
  'User-Agent',
  'X-API-Key',
  'X-Requested-With',
] as const

export const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
  'text/xml',
  'application/javascript',
  'application/octet-stream',
] as const

/**
 * Progressive 4D REST path autocomplete — only the next path chunk.
 * @see https://developer.4d.com/docs/category/rest-api
 */
export const REST_ROOT = '/rest'

/** Placeholder dataclass name used when the catalog is empty. */
const REST_EXAMPLE_DATACLASS = 'Employee'

const REST_SPECIALS = ['$catalog', '$info', '$upload', '$singleton'] as const

function catalogNames(dataclassNames: readonly string[]): string[] {
  const names =
    dataclassNames.length > 0
      ? [...new Set(dataclassNames.filter(Boolean))]
      : [REST_EXAMPLE_DATACLASS]
  return names.sort((a, b) => a.localeCompare(b))
}

function uniqSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function startsWithCI(value: string, prefix: string): boolean {
  return value.toLowerCase().startsWith(prefix.toLowerCase())
}

function equalsCI(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Unique request paths from HTTP history for the current target (most recent first).
 */
export function recentPathsFromHttpHistory(
  requests: readonly {
    seed: {
      path?: string
      targetMode?: HttpTargetMode
      customOrigin?: string
    }
  }[],
  options: {
    targetMode: HttpTargetMode
    customOrigin?: string
    limit?: number
  }
): string[] {
  const limit = options.limit ?? 20
  const wantCustom = options.targetMode === 'custom'
  const wantOrigin = (options.customOrigin ?? '').trim().replace(/\/$/, '').toLowerCase()
  const seen = new Set<string>()
  const paths: string[] = []

  for (const item of requests) {
    const seed = item.seed
    const isCustom = seed.targetMode === 'custom'
    if (isCustom !== wantCustom) continue
    if (wantCustom) {
      const seedOrigin = (seed.customOrigin ?? '').trim().replace(/\/$/, '').toLowerCase()
      if (wantOrigin && seedOrigin && seedOrigin !== wantOrigin) continue
    }
    const path = (seed.path ?? '').trim()
    if (!path || path === '/') continue
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    paths.push(path)
    if (paths.length >= limit) break
  }

  return paths
}

/**
 * Merge recently visited paths ahead of catalog path suggestions (case-insensitive dedupe).
 */
export function mergeRestPathSuggestions(
  catalogSuggestions: readonly string[],
  recentPaths: readonly string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of [...recentPaths, ...catalogSuggestions]) {
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(path)
  }
  return out
}

/** Keep suggestions that extend `input` (case-insensitive); drop exact matches. */
function extendingPrefix(paths: readonly string[], input: string): string[] {
  return paths.filter((path) => startsWithCI(path, input) && !equalsCI(path, input))
}

/** Per-dataclass members used to flesh out REST path autocomplete. */
export type RestPathClassMembers = {
  attributes?: readonly string[]
  /** Exposed methods with `applyTo: 'entity'`. */
  entityMethods?: readonly string[]
  /** Exposed methods with `applyTo: 'dataClass'` (or unset). */
  dataClassMethods?: readonly string[]
}

/** Map of dataclass name → attributes / methods for path suggestions. */
export type RestPathCatalog = Readonly<Record<string, RestPathClassMembers>>

/** Build a path-suggestion catalog from REST `$catalog` dataclasses. */
export function buildRestPathCatalog(
  dataClasses: readonly {
    name: string
    attributes?: readonly { name: string; scope?: string }[]
    methods?: readonly {
      name: string
      applyTo?: string
      exposed?: boolean
      scope?: string
    }[]
  }[]
): RestPathCatalog {
  const catalog: Record<string, RestPathClassMembers> = {}
  for (const dataClass of dataClasses) {
    const attributes = (dataClass.attributes ?? [])
      .filter((attr) => attr.scope !== 'protected')
      .map((attr) => attr.name)
      .filter(Boolean)
    const exposedMethods = (dataClass.methods ?? []).filter((method) => {
      if (method.exposed === true) return true
      if (method.exposed === false) return false
      const scope = typeof method.scope === 'string' ? method.scope.trim() : ''
      if (scope === 'publicOnServer') return false
      return scope === 'public'
    })
    const entityMethods = exposedMethods
      .filter((method) => method.applyTo === 'entity')
      .map((method) => method.name)
    const dataClassMethods = exposedMethods
      .filter((method) => !method.applyTo || method.applyTo === 'dataClass')
      .map((method) => method.name)
    catalog[dataClass.name] = {
      attributes: [...new Set(attributes)].sort((a, b) => a.localeCompare(b)),
      entityMethods: [...new Set(entityMethods)].sort((a, b) => a.localeCompare(b)),
      dataClassMethods: [...new Set(dataClassMethods)].sort((a, b) => a.localeCompare(b)),
    }
  }
  return catalog
}

function membersFor(catalog: RestPathCatalog | undefined, dataClass: string): RestPathClassMembers {
  if (!catalog) return {}
  const direct = catalog[dataClass]
  if (direct) return direct
  const lower = dataClass.toLowerCase()
  for (const [name, members] of Object.entries(catalog)) {
    if (name.toLowerCase() === lower) return members
  }
  return {}
}

function colonFilterSuggestions(base: string, attributes: readonly string[]): string[] {
  if (attributes.length === 0) return [`${base}:attribute(value)`]
  return attributes.map((attr) => `${base}:${attr}(value)`)
}

function dataClassLevelPaths(base: string, members: RestPathClassMembers): string[] {
  const methods = members.dataClassMethods ?? []
  return uniqSorted([`${base}/$entityset/`, ...methods.map((name) => `${base}/${name}`)])
}

function entityMemberPaths(base: string, key: string, members: RestPathClassMembers): string[] {
  const attrs = members.attributes ?? []
  const methods = members.entityMethods ?? []
  const paths = [
    `${base}${key}/`,
    ...attrs.map((name) => `${base}${key}/${name}`),
    ...methods.map((name) => `${base}${key}/${name}`),
  ]
  return uniqSorted(paths)
}

function matchDataClass(pathAfterRest: string, names: readonly string[]): string | null {
  const lower = pathAfterRest.toLowerCase()
  for (const name of names) {
    const n = name.toLowerCase()
    if (
      lower === n ||
      lower.startsWith(`${n}/`) ||
      lower.startsWith(`${n}?`) ||
      lower.startsWith(`${n}[`) ||
      lower.startsWith(`${n}(`) ||
      lower.startsWith(`${n}:`)
    ) {
      return name
    }
  }
  return null
}

/**
 * Build the next path chunk suggestions for the HTTP Client URL field.
 * Empty → `/rest`; after `/rest` → `$catalog` / `$info` / dataclasses; and so on.
 * Prefix matching is case-insensitive; returned paths use catalog casing.
 * When `catalog` is provided, attribute / method segments use real names.
 */
export function buildRestPathSuggestions(
  currentPath: string,
  dataclassNames: readonly string[] = [],
  catalog?: RestPathCatalog
): string[] {
  const names = catalogNames(dataclassNames)
  const input = currentPath.trim()

  if (!input || input === '/') {
    return [REST_ROOT]
  }

  // Still typing the root.
  if (startsWithCI(REST_ROOT, input) && !equalsCI(input, REST_ROOT) && input !== `${REST_ROOT}/`) {
    return [REST_ROOT]
  }

  if (equalsCI(input, REST_ROOT) || equalsCI(input, `${REST_ROOT}/`)) {
    return uniqSorted([
      `${REST_ROOT}/$catalog`,
      `${REST_ROOT}/$info`,
      `${REST_ROOT}/$upload`,
      `${REST_ROOT}/$singleton`,
      ...names.map((name) => `${REST_ROOT}/${name}`),
    ])
  }

  if (!startsWithCI(input, `${REST_ROOT}/`) && !startsWithCI(input, `${REST_ROOT}?`)) {
    return [REST_ROOT]
  }

  const afterRoot = input.slice(REST_ROOT.length) // starts with / or ?
  const afterSlash = afterRoot.startsWith('/') ? afterRoot.slice(1) : afterRoot

  // /rest/$catalog → next: /$all or /{dataClass}
  if (equalsCI(afterSlash, '$catalog') || equalsCI(afterSlash, '$catalog/')) {
    return uniqSorted([
      `${REST_ROOT}/$catalog/$all`,
      ...names.map((name) => `${REST_ROOT}/$catalog/${name}`),
    ])
  }
  if (startsWithCI(afterSlash, '$catalog/') && !equalsCI(afterSlash, '$catalog/$all')) {
    const catalogNext = uniqSorted([
      `${REST_ROOT}/$catalog/$all`,
      ...names.map((name) => `${REST_ROOT}/$catalog/${name}`),
    ])
    return extendingPrefix(catalogNext, input)
  }

  // /rest/$info — leaf
  if (equalsCI(afterSlash, '$info')) {
    return []
  }
  if (startsWithCI('$info', afterSlash) && afterSlash.startsWith('$')) {
    const specials = REST_SPECIALS.map((s) => `${REST_ROOT}/${s}`)
    const matched = extendingPrefix(specials, input)
    if (matched.length) return matched
  }

  // /rest/$upload — leaf (use Params for $rawPict / $binary)
  if (equalsCI(afterSlash, '$upload') || startsWithCI(afterSlash, '$upload')) {
    return []
  }

  // /rest/$singleton → class/function template
  if (equalsCI(afterSlash, '$singleton') || equalsCI(afterSlash, '$singleton/')) {
    return [`${REST_ROOT}/$singleton/SingletonClass/functionName`]
  }
  if (startsWithCI(afterSlash, '$singleton/')) {
    const next = `${REST_ROOT}/$singleton/SingletonClass/functionName`
    return extendingPrefix([next], input)
  }

  // Partial special while typing $c / $u / …
  if (afterSlash.startsWith('$') && !afterSlash.includes('/') && !afterSlash.includes('?')) {
    const specials = REST_SPECIALS.map((s) => `${REST_ROOT}/${s}`)
    const matched = extendingPrefix(specials, input)
    if (matched.length) return matched
  }

  const dataClass = matchDataClass(afterSlash, names)

  // Typing a dataclass name: /rest/Em → /rest/Employee (case-insensitive)
  if (!dataClass) {
    const fromNames = names.map((name) => `${REST_ROOT}/${name}`)
    const fromSpecials = REST_SPECIALS.map((s) => `${REST_ROOT}/${s}`)
    return uniqSorted(extendingPrefix([...fromSpecials, ...fromNames], input))
  }

  const base = `${REST_ROOT}/${dataClass}`
  const members = membersFor(catalog, dataClass)
  const attributes = members.attributes ?? []
  // Slice using the matched prefix length in the typed path (same char length as canonical name).
  const remainder = afterSlash.slice(dataClass.length)

  // Query strings belong in the Params tab — do not propose them here.
  if (remainder.includes('?')) {
    return []
  }

  // Exact /rest/Employee
  if (remainder === '') {
    return uniqSorted([
      `${base}[1]`,
      `${base}(1)`,
      ...colonFilterSuggestions(base, attributes),
      `${base}/`,
      `${base}/$entityset/`,
    ])
  }

  // /rest/Employee/
  if (remainder === '/') {
    return dataClassLevelPaths(base, members)
  }

  // Entity by key: /rest/Employee[1] or (1)
  const entityKeyMatch = remainder.match(/^(\[\d+\]|\(\d+\))$/)
  if (entityKeyMatch) {
    const key = entityKeyMatch[1]
    return entityMemberPaths(base, key, members)
  }

  const entityKeyPrefix = remainder.match(/^(\[\d+\]|\(\d+\))(.*)$/)
  if (entityKeyPrefix) {
    const key = entityKeyPrefix[1]
    const rest = entityKeyPrefix[2]
    if (rest === '/' || rest.startsWith('/')) {
      return extendingPrefix(entityMemberPaths(base, key, members), input)
    }
  }

  // /rest/Employee/$entityset/
  if (equalsCI(remainder, '/$entityset') || equalsCI(remainder, '/$entityset/')) {
    return [`${base}/$entityset/{entitySetID}`]
  }

  // /rest/Employee/… dataclass methods / $entityset while typing
  if (remainder.startsWith('/')) {
    return extendingPrefix(dataClassLevelPaths(base, members), input)
  }

  // Partial continuation under the dataclass (e.g. /rest/Employee/[ )
  const underClass = uniqSorted([
    `${base}[1]`,
    `${base}(1)`,
    ...colonFilterSuggestions(base, attributes),
    `${base}/`,
    `${base}/$entityset/`,
    ...dataClassLevelPaths(base, members).filter((path) => path !== `${base}/$entityset/`),
  ])
  return extendingPrefix(underClass, input)
}

/**
 * Documented 4D REST query parameter names for Params autocomplete.
 * @see https://developer.4d.com/docs/category/api-dataclass
 * @see https://developer.4d.com/docs/category/api-general
 */
export const REST_QUERY_PARAMS = [
  '$filter',
  '$orderby',
  '$skip',
  '$top',
  '$limit',
  '$attributes',
  '$expand',
  '$method',
  '$timeout',
  '$savedfilter',
  '$savedorderby',
  '$params',
  '$asArray',
  '$atomic',
  '$atOnce',
  '$binary',
  '$rawPict',
  '$clean',
  '$compute',
  '$distinct',
  '$format',
  '$imageformat',
  '$lock',
  '$querypath',
  '$queryplan',
  '$version',
  '$subOrderby',
] as const

const REST_QUERY_PARAM_VALUES: Record<string, readonly string[]> = {
  $method: ['entityset', 'delete', 'update', 'release', 'subentityset'],
  $compute: ['sum', 'average', 'min', 'max', 'count', 'all'],
  $imageformat: ['best', 'png', 'jpeg', 'gif', 'bmp', 'tiff'],
  $asArray: ['true', 'false'],
  $atomic: ['true', 'false'],
  $atOnce: ['true', 'false'],
  $binary: ['true', 'false'],
  $rawPict: ['true', 'false'],
  $clean: ['true', 'false'],
  $distinct: ['true', 'false'],
  $querypath: ['true', 'false'],
  $queryplan: ['true', 'false'],
  $lock: ['true', 'false'],
  $format: ['json', 'looker'],
  $top: ['10', '20', '50', '100'],
  $limit: ['10', '20', '50', '100'],
  $skip: ['0', '10', '20', '50', '100'],
  $timeout: ['600', '1200', '1800', '3600', '7200'],
  $version: ['1'],
  $filter: ['""', '"attr=value"', '"attr begin x"', '"attr!=\'\' AND attr2>0"'],
  $orderby: ['attr asc', 'attr desc', 'attr1 asc, attr2 desc'],
  $savedfilter: ['""'],
  $savedorderby: [''],
  $params: ["'[]'", '\'["value"]\''],
}

/** Value suggestions for a REST query param key (case-insensitive `$` names). */
export function restParamValueSuggestions(key: string): readonly string[] {
  const trimmed = key.trim()
  if (!trimmed) return []
  const direct = REST_QUERY_PARAM_VALUES[trimmed]
  if (direct) return direct
  const lower = trimmed.toLowerCase()
  for (const [name, values] of Object.entries(REST_QUERY_PARAM_VALUES)) {
    if (name.toLowerCase() === lower) return values
  }
  return []
}

export function createEmptyHttpDraft(seed?: HttpClientSeed): HttpClientRequestDraft {
  const body = normalizeHttpBody(seed?.body)
  const settings = normalizeHttpSettings(seed?.settings)
  return {
    method: seed?.method ?? 'GET',
    customMethod: seed?.customMethod ?? '',
    targetMode: seed?.targetMode ?? 'current',
    customOrigin: seed?.customOrigin ?? '',
    path: seed?.path ?? '/rest/',
    params: seed?.params?.length ? seed.params : [],
    headers: seed?.headers?.length ? seed.headers : [],
    body,
    settings,
    disabledBuiltInHeaders: normalizeDisabledBuiltInHeaders(seed?.disabledBuiltInHeaders),
  }
}

/** Serialize a live draft into a replayable seed (safe to persist). */
export function draftToHttpSeed(draft: HttpClientRequestDraft): HttpClientSeed {
  return {
    method: draft.method,
    customMethod: draft.customMethod || undefined,
    targetMode: draft.targetMode,
    customOrigin: draft.targetMode === 'custom' ? draft.customOrigin : undefined,
    path: draft.path,
    params: draft.params.length > 0 ? draft.params : undefined,
    headers: draft.headers.length > 0 ? draft.headers : undefined,
    body: draft.body.mode === 'none' ? undefined : { ...draft.body },
    settings: { ...draft.settings },
    disabledBuiltInHeaders:
      draft.disabledBuiltInHeaders.length > 0 ? [...draft.disabledBuiltInHeaders] : undefined,
  }
}

export function resolveHttpMethod(
  draft: Pick<HttpClientRequestDraft, 'method' | 'customMethod'>
): string {
  if (draft.method === 'CUSTOM') {
    return draft.customMethod.trim().toUpperCase() || 'GET'
  }
  return draft.method
}

export function splitOriginAndPath(url: string): { origin: string; path: string } | null {
  try {
    const parsed = new URL(url)
    return {
      origin: parsed.origin,
      path: `${parsed.pathname}${parsed.search}`,
    }
  } catch {
    return null
  }
}

export function joinOriginAndPath(origin: string, path: string): string {
  const trimmedOrigin = origin.replace(/\/$/, '')
  if (!path) return trimmedOrigin
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${trimmedOrigin}${normalizedPath}`
}

export function paramsFromSearch(search: string): HttpKeyValuePair[] {
  const query = search.startsWith('?') ? search.slice(1) : search
  if (!query) return []
  const params = new URLSearchParams(query)
  const result: HttpKeyValuePair[] = []
  for (const [key, value] of params.entries()) {
    result.push({
      id: `${key}-${result.length}-${Math.random().toString(36).slice(2, 7)}`,
      key,
      value,
      enabled: true,
    })
  }
  return result
}

export function applyParamsToPath(path: string, params: HttpKeyValuePair[]): string {
  let pathname = path
  let existingSearch = ''
  try {
    const parsed = new URL(path, 'http://http-client.local')
    pathname = path.startsWith('http') ? `${parsed.pathname}` : (path.split('?')[0] ?? path)
    if (!path.startsWith('http')) {
      pathname = path.split('?')[0] ?? path
    } else {
      pathname = `${parsed.pathname}`
    }
    existingSearch = parsed.search
  } catch {
    const q = path.indexOf('?')
    pathname = q >= 0 ? path.slice(0, q) : path
    existingSearch = q >= 0 ? path.slice(q) : ''
  }

  // Prefer the editable params table over any stale query string in the path.
  const enabled = params.filter((p) => p.enabled && p.key.trim())
  if (enabled.length === 0) {
    // Keep path without query when params are empty (table is source of truth).
    void existingSearch
    return pathname || '/'
  }

  const search = new URLSearchParams()
  for (const param of enabled) {
    search.append(param.key.trim(), param.value)
  }
  const query = search.toString()
  return query ? `${pathname || '/'}?${query}` : pathname || '/'
}

export function syncParamsFromPath(path: string): HttpKeyValuePair[] {
  const q = path.indexOf('?')
  if (q < 0) return []
  return paramsFromSearch(path.slice(q + 1))
}

function enabledPairs(pairs: HttpKeyValuePair[]): HttpKeyValuePair[] {
  return pairs.filter((pair) => pair.enabled && pair.key.trim())
}

function pairsToRecord(pairs: HttpKeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of enabledPairs(pairs)) {
    result[pair.key.trim()] = pair.value
  }
  return result
}

function findHeader(
  headers: Record<string, string>,
  name: string
): { key: string; value: string } | undefined {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return { key, value }
  }
  return undefined
}

function setHeaderIfMissing(
  headers: Record<string, string>,
  name: string,
  value: string
): Record<string, string> {
  if (findHeader(headers, name)) return headers
  return { ...headers, [name]: value }
}

function removeHeader(headers: Record<string, string>, name: string): Record<string, string> {
  const lower = name.toLowerCase()
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) next[key] = value
  }
  return next
}

export function normalizeDisabledBuiltInHeaders(names?: readonly string[] | null): string[] {
  if (!names?.length) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const lower = name.trim().toLowerCase()
    if (!lower || seen.has(lower)) continue
    seen.add(lower)
    result.push(lower)
  }
  return result
}

export function isBuiltInHeaderDisabled(
  disabled: readonly string[] | undefined,
  name: string
): boolean {
  const lower = name.toLowerCase()
  return (disabled ?? []).some((entry) => entry.toLowerCase() === lower)
}

function findUserHeader(
  headers: readonly HttpKeyValuePair[],
  name: string
): HttpKeyValuePair | undefined {
  const lower = name.toLowerCase()
  return headers.find((pair) => pair.key.trim().toLowerCase() === lower)
}

function serializeConnectionCookies(): string | undefined {
  const cookies = getCookies()
  const names = Object.keys(cookies)
  if (names.length === 0) return undefined
  return names.map((name) => `${name}=${cookies[name]}`).join('; ')
}

function resolveDraftOrigin(draft: HttpClientRequestDraft): {
  origin: string
  isCurrentServer: boolean
  url: string
} {
  const currentOrigin = getBaseUrl().replace(/\/$/, '')
  const customOrigin = draft.customOrigin.trim().replace(/\/$/, '')
  const origin = draft.targetMode === 'custom' ? customOrigin : currentOrigin
  if (!origin) {
    throw new Error('A server origin is required')
  }
  if (draft.targetMode === 'custom') {
    try {
      new URL(origin)
    } catch {
      throw new Error('Custom origin must be a valid URL (e.g. https://example.com)')
    }
  }
  const pathWithParams = applyParamsToPath(draft.path || '/', draft.params)
  const url = joinOriginAndPath(origin, pathWithParams)
  return { origin, isCurrentServer: originsMatch(origin, currentOrigin), url }
}

/** Origin header value for the request target (scheme + host + port). */
export function resolveRequestOriginHeader(draft: HttpClientRequestDraft): string | undefined {
  try {
    const { url } = resolveDraftOrigin(draft)
    return new URL(url).origin
  } catch {
    return undefined
  }
}

function estimateContentLength(draft: HttpClientRequestDraft): string | undefined {
  const method = resolveHttpMethod(draft)
  if (method === 'GET' || method === 'HEAD') return undefined
  const body = draft.body
  if (body.mode === 'none') return '0'
  if (body.mode === 'urlencoded') {
    return String(new TextEncoder().encode(buildUrlEncodedBody(body.urlencoded)).length)
  }
  if (body.mode === 'raw') {
    return String(new TextEncoder().encode(body.raw).length)
  }
  if (body.mode === 'binary' && body.binaryBase64) {
    try {
      return String(base64ToUint8Array(body.binaryBase64).byteLength)
    } catch {
      return undefined
    }
  }
  // form-data / live File — length known only at send time
  return undefined
}

/**
 * Built-in / transport headers that will be (or would be) applied for this draft.
 * Desktop includes UA / Origin / Accept / Host; web only shows connection + cookie.
 */
export function listHttpBuiltInHeaders(draft: HttpClientRequestDraft): HttpBuiltInHeader[] {
  let resolved: { isCurrentServer: boolean; url: string }
  try {
    resolved = resolveDraftOrigin(draft)
  } catch {
    return []
  }
  const { isCurrentServer, url } = resolved
  const settings = normalizeHttpSettings(draft.settings)
  const disabledBuiltIns = draft.disabledBuiltInHeaders
  const desktop = isDesktop()
  const rows: HttpBuiltInHeader[] = []

  const push = (
    key: string,
    value: string,
    source: HttpBuiltInHeaderSource,
    editable = true
  ): void => {
    const user = findUserHeader(draft.headers, key)
    const overridden = Boolean(user?.enabled && user.key.trim())
    const isDisabled = isBuiltInHeaderDisabled(disabledBuiltIns, key)
    const enabled = source === 'cookie' ? settings.sendCookies && !isDisabled : !isDisabled
    rows.push({
      key,
      value: overridden && user ? user.value : value,
      source,
      enabled,
      overridden,
      editable,
    })
  }

  if (isCurrentServer) {
    for (const [key, value] of Object.entries(getCustomHeaders())) {
      if (!key.trim()) continue
      push(key, value, 'connection')
    }
  }

  if (isCurrentServer) {
    const cookie = serializeConnectionCookies()
    if (cookie || desktop) {
      // Enable/disable only — individual cookies are edited in the cookie jar UI.
      push('Cookie', cookie ?? '', 'cookie', false)
    }
  }

  if (desktop) {
    const requestOrigin = resolveRequestOriginHeader(draft)
    push('User-Agent', getDesktopHttpUserAgent(), 'user-agent')
    if (requestOrigin) push('Origin', requestOrigin, 'origin')
    push('Accept', DESKTOP_HTTP_ACCEPT, 'accept')
    try {
      const host = new URL(url).host
      if (host) push('Host', host, 'host')
    } catch {
      // ignore invalid URL edge cases
    }
    const contentLength = estimateContentLength(draft)
    push('Content-Length', contentLength ?? '(auto)', 'content-length')
  }

  return rows
}

/** Toggle a built-in header on/off; keeps Settings.sendCookies in sync for Cookie. */
export function setBuiltInHeaderEnabled(
  draft: HttpClientRequestDraft,
  headerName: string,
  enabled: boolean
): Pick<HttpClientRequestDraft, 'disabledBuiltInHeaders' | 'settings' | 'headers'> {
  const lower = headerName.trim().toLowerCase()
  let disabled = normalizeDisabledBuiltInHeaders(draft.disabledBuiltInHeaders)
  if (enabled) {
    disabled = disabled.filter((name) => name !== lower)
  } else if (!disabled.includes(lower)) {
    disabled = [...disabled, lower]
  }

  let settings = draft.settings
  if (lower === 'cookie') {
    settings = { ...settings, sendCookies: enabled }
  }

  // Drop empty sentinel overrides when re-enabling / disabling transport defaults.
  let headers = draft.headers
  if (lower === 'origin' || lower === 'user-agent' || lower === 'accept') {
    headers = headers.filter((pair) => {
      if (pair.key.trim().toLowerCase() !== lower) return true
      return pair.value !== ''
    })
  }

  return { disabledBuiltInHeaders: disabled, settings, headers }
}

/** Promote a built-in header into an enabled user override. */
export function upsertBuiltInHeaderOverride(
  draft: HttpClientRequestDraft,
  headerName: string,
  value: string
): Pick<HttpClientRequestDraft, 'headers' | 'disabledBuiltInHeaders' | 'settings'> {
  const key = headerName.trim()
  const lower = key.toLowerCase()
  const disabled = normalizeDisabledBuiltInHeaders(draft.disabledBuiltInHeaders).filter(
    (name) => name !== lower
  )
  const existing = findUserHeader(draft.headers, key)
  let headers: HttpKeyValuePair[]
  if (existing) {
    headers = draft.headers.map((pair) =>
      pair.id === existing.id ? { ...pair, key, value, enabled: true } : pair
    )
  } else {
    headers = [
      ...draft.headers,
      {
        id: createHttpId(),
        key,
        value,
        enabled: true,
      },
    ]
  }

  let settings = draft.settings
  if (lower === 'cookie') {
    settings = { ...settings, sendCookies: true }
  }

  return { headers, disabledBuiltInHeaders: disabled, settings }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64ToBlob(base64: string, contentType?: string): Blob {
  const bytes = base64ToUint8Array(base64)
  // Copy into a fresh ArrayBuffer-backed view for BlobPart typing compatibility.
  const copy = new Uint8Array(bytes)
  return new Blob([copy], { type: contentType || 'application/octet-stream' })
}

async function buildFormDataBody(
  fields: HttpFormDataField[],
  fileMap?: Map<string, File>
): Promise<FormData> {
  const form = new FormData()
  for (const field of fields) {
    if (!field.enabled || !field.key.trim()) continue
    if (field.kind === 'text') {
      form.append(field.key.trim(), field.value)
      continue
    }
    const liveFile = fileMap?.get(field.id)
    if (liveFile) {
      form.append(field.key.trim(), liveFile, liveFile.name)
      continue
    }
    if (field.fileBase64 && field.fileName) {
      form.append(
        field.key.trim(),
        base64ToBlob(field.fileBase64, field.contentType),
        field.fileName
      )
    }
  }
  return form
}

function buildUrlEncodedBody(pairs: HttpKeyValuePair[]): string {
  const search = new URLSearchParams()
  for (const pair of enabledPairs(pairs)) {
    search.append(pair.key.trim(), pair.value)
  }
  return search.toString()
}

export function inferRawContentType(
  language: HttpBodyState['rawLanguage'],
  fallback: string
): string {
  switch (language) {
    case 'json':
      return 'application/json'
    case 'xml':
      return 'application/xml'
    case 'html':
      return 'text/html'
    case 'javascript':
      return 'application/javascript'
    case 'text':
      return 'text/plain'
    default:
      return fallback || 'text/plain'
  }
}

function resolvePairEnv(
  pair: HttpKeyValuePair,
  map: Map<string, string>,
  thisRoot?: unknown
): { pair: HttpKeyValuePair; unresolved: string[] } {
  const opts = thisRoot !== undefined ? { this: thisRoot } : undefined
  const key = resolveEnvTemplates(pair.key, map, opts)
  const value = resolveEnvTemplates(pair.value, map, opts)
  return {
    pair: { ...pair, key: key.text, value: value.text },
    unresolved: mergeUnresolved(key.unresolved, value.unresolved),
  }
}

const HTTP_THIS_PASSES = 8

function draftStillHasTemplates(draft: HttpClientRequestDraft): boolean {
  if (draft.customOrigin.includes('{{')) return true
  if (draft.path.includes('{{')) return true
  if (draft.customMethod.includes('{{')) return true
  if (draft.body.raw.includes('{{')) return true
  if (draft.body.rawContentType.includes('{{')) return true
  for (const pair of draft.params) {
    if (pair.key.includes('{{') || pair.value.includes('{{')) return true
  }
  for (const pair of draft.headers) {
    if (pair.key.includes('{{') || pair.value.includes('{{')) return true
  }
  for (const pair of draft.body.urlencoded) {
    if (pair.key.includes('{{') || pair.value.includes('{{')) return true
  }
  for (const field of draft.body.formData) {
    if (field.key.includes('{{')) return true
    if (field.kind === 'text' && field.value.includes('{{')) return true
  }
  return false
}

function resolveHttpClientDraftEnvOnce(
  draft: HttpClientRequestDraft,
  map: Map<string, string>,
  thisRoot: unknown
): { draft: HttpClientRequestDraft; unresolved: string[] } {
  const opts = { this: thisRoot }
  const unresolved: string[] = []
  const push = (keys: string[]) => {
    for (const key of keys) {
      if (!unresolved.includes(key)) unresolved.push(key)
    }
  }

  const customOrigin = resolveEnvTemplates(draft.customOrigin, map, opts)
  push(customOrigin.unresolved)
  const path = resolveEnvTemplates(draft.path, map, opts)
  push(path.unresolved)
  const customMethod = resolveEnvTemplates(draft.customMethod, map, opts)
  push(customMethod.unresolved)

  const params = draft.params.map((pair) => {
    const resolved = resolvePairEnv(pair, map, thisRoot)
    push(resolved.unresolved)
    return resolved.pair
  })
  const headers = draft.headers.map((pair) => {
    const resolved = resolvePairEnv(pair, map, thisRoot)
    push(resolved.unresolved)
    return resolved.pair
  })

  const raw = resolveEnvTemplates(draft.body.raw, map, opts)
  push(raw.unresolved)
  const rawContentType = resolveEnvTemplates(draft.body.rawContentType, map, opts)
  push(rawContentType.unresolved)
  const urlencoded = draft.body.urlencoded.map((pair) => {
    const resolved = resolvePairEnv(pair, map, thisRoot)
    push(resolved.unresolved)
    return resolved.pair
  })
  const formData = draft.body.formData.map((field) => {
    const key = resolveEnvTemplates(field.key, map, opts)
    push(key.unresolved)
    if (field.kind === 'text') {
      const value = resolveEnvTemplates(field.value, map, opts)
      push(value.unresolved)
      return { ...field, key: key.text, value: value.text }
    }
    return { ...field, key: key.text }
  })

  return {
    draft: {
      ...draft,
      customOrigin: customOrigin.text,
      path: path.text,
      customMethod: customMethod.text,
      params,
      headers,
      body: {
        ...draft.body,
        raw: raw.text,
        rawContentType: rawContentType.text,
        urlencoded,
        formData,
      },
    },
    unresolved,
  }
}

/** Resolve `{{var}}` / `{{$this…}}` templates in an HTTP draft before build/send. */
export function resolveHttpClientDraftEnv(draft: HttpClientRequestDraft): {
  draft: HttpClientRequestDraft
  unresolved: string[]
} {
  const map = getActiveEnvMap()
  let current = draft
  let unresolved: string[] = []

  for (let pass = 0; pass < HTTP_THIS_PASSES; pass++) {
    if (!draftStillHasTemplates(current)) {
      return { draft: current, unresolved: [] }
    }
    const thisRoot = buildHttpThis(current)
    const result = resolveHttpClientDraftEnvOnce(current, map, thisRoot)
    unresolved = result.unresolved
    if (JSON.stringify(result.draft) === JSON.stringify(current)) {
      return { draft: result.draft, unresolved }
    }
    current = result.draft
  }

  return { draft: current, unresolved }
}

export function buildHttpRequest(
  draft: HttpClientRequestDraft,
  options?: { fileMap?: Map<string, File>; binaryFile?: File | null }
): BuiltHttpRequest {
  const { draft: resolvedDraft, unresolved } = resolveHttpClientDraftEnv(draft)
  if (unresolved.length > 0) {
    consoleService.warn(`Unresolved environment variables: ${unresolved.join(', ')}`)
  }
  const settings = normalizeHttpSettings(resolvedDraft.settings)
  const method = resolveHttpMethod(resolvedDraft)
  const { isCurrentServer, url } = resolveDraftOrigin(resolvedDraft)
  const disabledBuiltIns = normalizeDisabledBuiltInHeaders(resolvedDraft.disabledBuiltInHeaders)
  const desktop = isDesktop()

  let headers = pairsToRecord(resolvedDraft.headers)

  // Current-connection custom headers only for the connected origin.
  if (isCurrentServer) {
    for (const [key, value] of Object.entries(getCustomHeaders())) {
      if (isBuiltInHeaderDisabled(disabledBuiltIns, key)) continue
      headers = setHeaderIfMissing(headers, key, value)
    }
  }

  let body: BodyInit | undefined
  const bodyMode = resolvedDraft.body.mode
  const methodAllowsBody = method !== 'GET' && method !== 'HEAD'

  if (methodAllowsBody && bodyMode === 'form-data') {
    // FormData sets its own multipart boundary — do not force Content-Type.
    headers = removeHeader(headers, 'Content-Type')
    body = undefined // filled async in execute; sync path builds below via promise helper
  } else if (methodAllowsBody && bodyMode === 'urlencoded') {
    body = buildUrlEncodedBody(resolvedDraft.body.urlencoded)
    headers = setHeaderIfMissing(headers, 'Content-Type', 'application/x-www-form-urlencoded')
  } else if (methodAllowsBody && bodyMode === 'raw') {
    body = resolvedDraft.body.raw
    const contentType =
      resolvedDraft.body.rawContentType.trim() ||
      inferRawContentType(resolvedDraft.body.rawLanguage, '')
    if (contentType) headers = setHeaderIfMissing(headers, 'Content-Type', contentType)
  } else if (methodAllowsBody && bodyMode === 'binary') {
    const live = options?.binaryFile
    if (live) {
      body = live
      headers = setHeaderIfMissing(
        headers,
        'Content-Type',
        live.type || resolvedDraft.body.binaryContentType || 'application/octet-stream'
      )
    } else if (resolvedDraft.body.binaryBase64) {
      body = base64ToBlob(resolvedDraft.body.binaryBase64, resolvedDraft.body.binaryContentType)
      headers = setHeaderIfMissing(
        headers,
        'Content-Type',
        resolvedDraft.body.binaryContentType || 'application/octet-stream'
      )
    }
  }

  const cookieDisabled = isBuiltInHeaderDisabled(disabledBuiltIns, 'Cookie')
  const sendCookies = settings.sendCookies && !cookieDisabled

  // Cookie handling for current server when enabled and not already set by user.
  if (sendCookies && isCurrentServer && !findHeader(headers, 'Cookie')) {
    const cookie = serializeConnectionCookies()
    if (cookie) headers.Cookie = cookie
  }

  // When cookies are disabled on desktop, an empty Cookie header suppresses the jar.
  if ((!sendCookies || cookieDisabled) && desktop && !findHeader(headers, 'Cookie')) {
    headers.Cookie = ''
  }

  if (desktop) {
    const applyDesktopDefault = (name: string, value: string): void => {
      if (findHeader(headers, name)) return
      if (isBuiltInHeaderDisabled(disabledBuiltIns, name)) {
        headers[name] = ''
        return
      }
      headers[name] = value
    }

    applyDesktopDefault('User-Agent', getDesktopHttpUserAgent())
    try {
      applyDesktopDefault('Origin', new URL(url).origin)
    } catch {
      // skip Origin if URL cannot be parsed
    }
    applyDesktopDefault('Accept', DESKTOP_HTTP_ACCEPT)

    if (!findHeader(headers, 'Host') && !isBuiltInHeaderDisabled(disabledBuiltIns, 'Host')) {
      try {
        const host = new URL(url).host
        if (host) headers.Host = host
      } catch {
        // ignore
      }
    }

    if (
      !findHeader(headers, 'Content-Length') &&
      !isBuiltInHeaderDisabled(disabledBuiltIns, 'Content-Length')
    ) {
      const contentLength = estimateContentLength(resolvedDraft)
      if (contentLength !== undefined) {
        headers['Content-Length'] = contentLength
      }
    }
  }

  return {
    method,
    url,
    headers,
    body,
    settings,
    isCurrentServer,
    unresolvedEnvKeys: unresolved.length > 0 ? unresolved : undefined,
  }
}

export async function buildHttpRequestAsync(
  draft: HttpClientRequestDraft,
  options?: { fileMap?: Map<string, File>; binaryFile?: File | null }
): Promise<BuiltHttpRequest> {
  const { draft: resolvedDraft } = resolveHttpClientDraftEnv(draft)
  const built = buildHttpRequest(draft, options)
  const methodAllowsBody = built.method !== 'GET' && built.method !== 'HEAD'
  if (methodAllowsBody && resolvedDraft.body.mode === 'form-data') {
    built.body = await buildFormDataBody(resolvedDraft.body.formData, options?.fileMap)
  }
  return built
}

function originsMatch(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return a.replace(/\/$/, '') === b.replace(/\/$/, '')
  }
}

function parseSetCookieHeaders(headers: Headers): HttpResponseCookie[] {
  const cookies: HttpResponseCookie[] = []
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const rawList =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : (() => {
          const single = headers.get('set-cookie')
          return single ? [single] : []
        })()

  for (const raw of rawList) {
    const [pair] = raw.split(';')
    const eq = pair.indexOf('=')
    if (eq < 0) {
      cookies.push({ name: pair.trim(), value: '', raw })
      continue
    }
    cookies.push({
      name: pair.slice(0, eq).trim(),
      value: pair.slice(eq + 1).trim(),
      raw,
    })
  }
  return cookies
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    // Preserve set-cookie visibility for the HTTP Client response pane.
    if (key.toLowerCase() === 'set-cookie' && result[key]) {
      result[key] = `${result[key]}, ${value}`
    } else {
      result[key] = value
    }
  })
  return result
}

function isTextualContentType(contentType: string | null): boolean {
  if (!contentType) return true
  const ct = contentType.toLowerCase()
  return (
    ct.includes('json') ||
    ct.startsWith('text/') ||
    ct.includes('xml') ||
    ct.includes('javascript') ||
    ct.includes('urlencoded') ||
    ct.includes('svg')
  )
}

/** Never buffer these into JS heap — they freeze the desktop webview. */
function isStreamingMediaContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  return ct.startsWith('video/') || ct.startsWith('audio/')
}

/** Soft cap for buffering any binary response body in the HTTP client. */
export const MAX_HTTP_CLIENT_BUFFER_BYTES = 8 * 1024 * 1024 // 8 MiB

function contentLengthFromHeaders(headers: Headers): number | undefined {
  const raw = headers.get('content-length')
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function shouldSkipBodyBuffer(
  contentType: string | null,
  contentLength: number | undefined
): boolean {
  if (isStreamingMediaContentType(contentType)) return true
  if (contentLength != null && contentLength > MAX_HTTP_CLIENT_BUFFER_BYTES) return true
  return false
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // ignore — body may already be locked/closed
  }
}

/**
 * Read a response body in chunks, yielding to the event loop so the UI stays
 * responsive. Stops and discards if the payload exceeds {@link maxBytes}.
 */
async function readResponseBytesLimited(
  response: Response,
  maxBytes: number
): Promise<{ bytes: Uint8Array | null; sizeBytes: number; truncated: boolean }> {
  const hinted = contentLengthFromHeaders(response.headers)
  if (hinted != null && hinted > maxBytes) {
    await cancelResponseBody(response)
    return { bytes: null, sizeBytes: hinted, truncated: true }
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxBytes) {
      return { bytes: null, sizeBytes: buffer.byteLength, truncated: true }
    }
    return { bytes: new Uint8Array(buffer), sizeBytes: buffer.byteLength, truncated: false }
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let chunkCount = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return { bytes: null, sizeBytes: hinted ?? total, truncated: true }
      }
      chunks.push(value)
      chunkCount += 1
      // Yield periodically so Cancel / UI paint stay responsive on desktop.
      if (chunkCount % 4 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, sizeBytes: total, truncated: false }
}

export async function executeHttpRequest(
  draft: HttpClientRequestDraft,
  options?: {
    signal?: AbortSignal
    fileMap?: Map<string, File>
    binaryFile?: File | null
  }
): Promise<HttpClientResponse> {
  const built = await buildHttpRequestAsync(draft, options)
  const settings = built.settings
  const timeout =
    settings.timeoutMs ?? (built.isCurrentServer ? getTimeout() : undefined) ?? undefined

  const controller = new AbortController()
  const external = options?.signal
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (timeout && timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeout)
  }

  const fetchOptions: RequestInit & HttpClientFetchOptions = {
    method: built.method,
    headers: built.headers,
    body: built.body,
    signal: controller.signal,
    sendCookies: settings.sendCookies,
    credentials: settings.sendCookies ? settings.credentials : 'omit',
    connectTimeout: timeout,
    maxRedirections: settings.followRedirects ? settings.maxRedirects : 0,
    skipSsl: settings.skipSsl || (built.isCurrentServer && getSkipSSL()),
  }

  const startedAt = performance.now()
  try {
    const response = await getLoggingFetch()(built.url, fetchOptions)
    const durationMs = performance.now() - startedAt
    const contentType = response.headers.get('content-type')
    const contentLength = contentLengthFromHeaders(response.headers)
    const textual = isTextualContentType(contentType)
    let bodyText: string | null = null
    let bodyJson: unknown | null = null
    let bodyBinary = false
    let bodyBytes: Uint8Array | undefined
    let bodyPreview: string | undefined
    let bodySkipped = false
    let sizeBytes = contentLength ?? 0

    if (textual) {
      const buffer = await response.arrayBuffer()
      sizeBytes = buffer.byteLength
      bodyText = new TextDecoder().decode(buffer)
      if (contentType?.includes('json') && bodyText.trim()) {
        try {
          bodyJson = JSON.parse(bodyText)
        } catch {
          // keep as text
        }
      }
    } else if (shouldSkipBodyBuffer(contentType, contentLength)) {
      bodyBinary = true
      bodySkipped = true
      await cancelResponseBody(response)
      sizeBytes = contentLength ?? 0
      bodyPreview = isStreamingMediaContentType(contentType)
        ? contentType
          ? `[${contentType} · not buffered — download to open]`
          : '[media · not buffered — download to open]'
        : contentType
          ? `[${contentType} · ${formatByteSize(sizeBytes)} · too large to buffer]`
          : `[binary · ${formatByteSize(sizeBytes)} · too large to buffer]`
    } else {
      bodyBinary = true
      const read = await readResponseBytesLimited(response, MAX_HTTP_CLIENT_BUFFER_BYTES)
      sizeBytes = read.sizeBytes
      if (read.truncated || !read.bytes) {
        bodySkipped = true
        bodyPreview = contentType
          ? `[${contentType} · ${formatByteSize(sizeBytes)} · too large to buffer]`
          : `[binary · ${formatByteSize(sizeBytes)} · too large to buffer]`
      } else {
        bodyBytes = read.bytes
        bodyPreview = contentType
          ? `[${contentType} · ${formatByteSize(sizeBytes)}]`
          : `[binary · ${formatByteSize(sizeBytes)}]`
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs,
      sizeBytes,
      url: response.url || built.url,
      headers: headersToRecord(response.headers),
      cookies: parseSetCookieHeaders(response.headers),
      contentType,
      bodyText,
      bodyJson,
      bodyBinary,
      bodyBytes,
      bodyPreview,
      bodySkipped,
    }
  } catch (error) {
    const durationMs = performance.now() - startedAt
    const errorInfo = analyzeHttpClientNetworkError(error, { url: built.url })
    return {
      status: 0,
      statusText: '',
      durationMs,
      sizeBytes: 0,
      url: built.url,
      headers: {},
      cookies: [],
      contentType: null,
      bodyText: null,
      bodyJson: null,
      bodyBinary: false,
      error: formatHttpClientNetworkErrorInfo(errorInfo),
      errorInfo,
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`
}

/**
 * Re-fetch a URL and stream the body to a download, yielding so the UI stays
 * responsive. Used when the HTTP client skipped buffering video/audio/large bodies.
 */
export async function streamDownloadFromUrl(options: {
  url: string
  filename: string
  mime?: string
  signal?: AbortSignal
  skipSsl?: boolean
  sendCookies?: boolean
}): Promise<void> {
  const response = await getLoggingFetch()(options.url, {
    method: 'GET',
    signal: options.signal,
    sendCookies: options.sendCookies ?? true,
    credentials: 'include',
    skipSsl: options.skipSsl ?? getSkipSSL(),
  } as RequestInit & HttpClientFetchOptions)

  if (!response.ok && response.status !== 0) {
    throw new Error(`Download failed (${response.status} ${response.statusText})`)
  }

  // Prefer streaming to a Blob of parts (avoids one giant intermediate merge until the end).
  if (!response.body) {
    const buffer = await response.arrayBuffer()
    await downloadBytes({
      filename: options.filename,
      bytes: new Uint8Array(buffer),
      mime: options.mime,
    })
    return
  }

  const reader = response.body.getReader()
  const parts: BlobPart[] = []
  let chunkCount = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Copy each chunk — stream buffers may be reused.
      parts.push(value.slice())
      chunkCount += 1
      if (chunkCount % 4 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  const blob = new Blob(parts, { type: options.mime ?? 'application/octet-stream' })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await downloadBytes({
    filename: options.filename,
    bytes,
    mime: options.mime,
  })
}

export function formatResponseBody(response: HttpClientResponse): string {
  if (response.error) return response.error
  if (response.bodyBinary) return response.bodyPreview ?? '[binary]'
  if (response.bodyJson !== null && response.bodyJson !== undefined) {
    try {
      return JSON.stringify(response.bodyJson, null, 2)
    } catch {
      // fall through
    }
  }
  return response.bodyText ?? ''
}

const GENERIC_FETCH_FAILURE =
  /failed to fetch|networkerror when attempting to fetch|load failed|network request failed|fetch failed/i

/**
 * Inspect a thrown fetch/network error for the HTTP client UI.
 * Browsers hide CORS details from scripts (often only "Failed to fetch"), so we
 * infer cross-origin / mixed-content context when that is the likely cause.
 */
export function analyzeHttpClientNetworkError(
  error: unknown,
  context: { url: string }
): HttpClientNetworkErrorInfo {
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      kind: 'cancelled',
      title: 'Request cancelled',
      name: error.name,
      message: error.message || 'Request cancelled',
      url: context.url,
      causes: [],
      hints: [],
    }
  }

  const message =
    error instanceof Error ? error.message || 'Request failed' : String(error) || 'Request failed'
  const name = error instanceof Error && error.name !== 'Error' ? error.name : undefined
  const causes: string[] = []

  if (error instanceof Error) {
    let cause: unknown = error.cause
    let depth = 0
    while (cause != null && depth < 5) {
      if (cause instanceof Error) {
        causes.push(
          cause.name && cause.name !== 'Error'
            ? `${cause.name}: ${cause.message}`
            : cause.message || String(cause)
        )
        cause = cause.cause
      } else {
        causes.push(String(cause))
        break
      }
      depth += 1
    }
  }

  let pageOrigin: string | undefined
  let targetOrigin: string | undefined
  let crossOrigin = false
  let mixedContent = false

  if (GENERIC_FETCH_FAILURE.test(message) && typeof window !== 'undefined') {
    try {
      const requestUrl = new URL(context.url, window.location.href)
      pageOrigin = window.location.origin
      targetOrigin = requestUrl.origin
      crossOrigin = pageOrigin !== 'null' && pageOrigin !== targetOrigin
      mixedContent = window.location.protocol === 'https:' && requestUrl.protocol === 'http:'
    } catch {
      // ignore invalid URL
    }
  }

  const hints: HttpClientNetworkErrorInfo['hints'] = []
  if (crossOrigin) {
    hints.push({ id: 'cors', tone: 'amber' })
    hints.push({ id: 'console', tone: 'muted' })
    if (!isDesktop()) {
      hints.push({ id: 'desktop', tone: 'muted' })
    }
  }
  if (mixedContent) {
    hints.push({ id: 'mixed-content', tone: 'destructive' })
  }

  const kind: HttpClientNetworkErrorInfo['kind'] = mixedContent
    ? 'mixed-content'
    : crossOrigin
      ? 'cors'
      : GENERIC_FETCH_FAILURE.test(message)
        ? 'network'
        : 'unknown'

  return {
    kind,
    title: message,
    name,
    message,
    url: context.url,
    causes,
    pageOrigin,
    targetOrigin,
    hints,
  }
}

export function formatHttpClientNetworkErrorInfo(info: HttpClientNetworkErrorInfo): string {
  if (info.kind === 'cancelled') return 'Request cancelled'

  const lines: string[] = []
  lines.push(info.name ? `${info.name}: ${info.message}` : info.message)
  for (const cause of info.causes) {
    lines.push(`Caused by: ${cause}`)
  }
  if (info.url) {
    lines.push('', `URL: ${info.url}`)
  }
  if (info.pageOrigin && info.targetOrigin && info.pageOrigin !== info.targetOrigin) {
    lines.push(
      '',
      `Cross-origin request (${info.pageOrigin} → ${info.targetOrigin}).`,
      'The browser likely blocked this response (CORS). Check the DevTools console for the Access-Control-Allow-Origin details — browsers do not expose that message to scripts.'
    )
  }
  if (info.hints.some((hint) => hint.id === 'mixed-content')) {
    lines.push(
      '',
      'Mixed content: this page is HTTPS but the request URL is HTTP, which browsers block.'
    )
  }
  return lines.join('\n')
}

export function formatHttpClientNetworkError(error: unknown, context: { url: string }): string {
  return formatHttpClientNetworkErrorInfo(analyzeHttpClientNetworkError(error, context))
}

export function rawLanguageFromContentType(
  contentType: string | null | undefined
): HttpBodyState['rawLanguage'] {
  if (!contentType) return 'text'
  const ct = contentType.toLowerCase()
  if (ct.includes('json')) return 'json'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('html')) return 'html'
  if (ct.includes('javascript')) return 'javascript'
  if (ct.startsWith('text/')) return 'text'
  return 'custom'
}

export function monacoLanguageForRaw(language: HttpBodyState['rawLanguage']): string {
  switch (language) {
    case 'json':
      return 'json'
    case 'xml':
      return 'xml'
    case 'html':
      return 'html'
    case 'javascript':
      return 'javascript'
    default:
      return 'plaintext'
  }
}

/** Sanitize sensitive header values when seeding from console logs. */
export function isRedactedValue(value: unknown): boolean {
  return typeof value === 'string' && value.includes(REDACTED)
}

export function draftLabel(draft: HttpClientRequestDraft): string {
  const method = resolveHttpMethod(draft)
  const path = draft.path.split('?')[0] || '/'
  return `${method} ${path}`
}
