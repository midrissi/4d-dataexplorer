import {
  type CatalogAllResponse,
  callDataClassFunction,
  callDataStoreFunction,
  callEntityFunction,
  callEntitySelectionFunction,
  type Entity,
  type EntityCollection,
  type QueryBuilder,
  type RESTClient,
} from '@4d/rest'
import { isAssistantExposedMethod } from '~/lib/assistant-exposed-method'
import { extractEntitySetId } from '~/lib/extract-entity-set-id'
import { ORDA_DATACLASS, ORDA_KIND } from './symbols'

const ENTITY_SET_TIMEOUT_SEC = 7200
const PREVIEW_TOP = 100

export type TerminalEntity = Entity &
  Record<string, unknown> & {
    getKey: () => string
  }

export type TerminalSelection = EntityCollection & {
  getKey: () => string | undefined
  getCount: () => number
}

type Thenable<T> = PromiseLike<T>

export type MethodMeta = {
  name: string
  scope: 'catalog' | 'dataclass' | 'entity' | 'entitySelection'
  dataClass?: string
  allowedOnHTTPGET?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Props that must never become fake REST method callers (React / inspectors). */
function isBlockedProxyProp(prop: string): boolean {
  if (prop.startsWith('$$') || prop.startsWith('__react')) return true
  switch (prop) {
    case 'constructor':
    case 'prototype':
    case '__proto__':
    case 'toJSON':
    case 'toString':
    case 'valueOf':
    case 'inspect':
    case 'nodeType':
    case 'asymmetricMatch':
      return true
    default:
      return false
  }
}

function splitAttributes(...attributes: string[]): string[] {
  return attributes
    .flatMap((attr) => attr.split(','))
    .map((attr) => attr.trim())
    .filter(Boolean)
}

function callOptions(meta?: MethodMeta, entitySetId?: string) {
  return {
    method: (meta?.allowedOnHTTPGET ? 'GET' : 'POST') as 'GET' | 'POST',
    entitySetId,
    createEntitySet: true as const,
  }
}

/** Normalize REST method results into terminal entity / selection wrappers when possible. */
export function normalizeMethodResult(value: unknown, fallbackDataClass?: string): unknown {
  if (!isRecord(value)) return value
  if (Array.isArray(value.__ENTITIES)) {
    const dc =
      typeof value.__entityModel === 'string'
        ? value.__entityModel
        : (fallbackDataClass ?? 'Entity')
    return wrapSelection(value as unknown as EntityCollection, dc)
  }
  if (
    '__KEY' in value ||
    typeof value.__DATACLASS === 'string' ||
    typeof value.__entityModel === 'string'
  ) {
    const dc =
      typeof value.__DATACLASS === 'string'
        ? value.__DATACLASS
        : typeof value.__entityModel === 'string'
          ? value.__entityModel
          : (fallbackDataClass ?? 'Entity')
    return wrapEntity(value as Entity & Record<string, unknown>, dc)
  }
  return value
}

export function wrapEntity(
  entity: Entity & Record<string, unknown>,
  dataClass: string
): TerminalEntity {
  const wrapped = Object.assign(Object.create(null), entity) as TerminalEntity
  Object.defineProperty(wrapped, ORDA_KIND, { value: 'entity', enumerable: false })
  Object.defineProperty(wrapped, ORDA_DATACLASS, { value: dataClass, enumerable: false })
  Object.defineProperty(wrapped, 'getKey', {
    value: () => String(entity.__KEY ?? ''),
    enumerable: false,
  })
  return wrapped
}

export function wrapSelection(collection: EntityCollection, dataClass: string): TerminalSelection {
  const wrapped = Object.assign(Object.create(null), collection) as TerminalSelection
  Object.defineProperty(wrapped, ORDA_KIND, { value: 'entitysel', enumerable: false })
  Object.defineProperty(wrapped, ORDA_DATACLASS, {
    value: typeof collection.__entityModel === 'string' ? collection.__entityModel : dataClass,
    enumerable: false,
  })
  Object.defineProperty(wrapped, 'getKey', {
    value: () => extractEntitySetId(collection.__ENTITYSET),
    enumerable: false,
  })
  Object.defineProperty(wrapped, 'getCount', {
    value: () =>
      typeof collection.__COUNT === 'number' ? collection.__COUNT : collection.__ENTITIES.length,
    enumerable: false,
  })
  return wrapped
}

function makeThenable<T>(
  execute: () => Promise<T>,
  chain: Record<string, unknown> = {}
): Thenable<T> & Record<string, unknown> {
  const run = () => execute()
  return {
    ...chain,
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable for ORDA await chaining
    then(
      onFulfilled?: ((value: T) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) {
      return run().then(onFulfilled, onRejected)
    },
    catch(onRejected?: ((reason: unknown) => unknown) | null) {
      return run().catch(onRejected)
    },
    finally(onFinally?: (() => void) | null) {
      return run().finally(onFinally ?? undefined)
    },
  } as Thenable<T> & Record<string, unknown>
}

function findMethod(
  methods: MethodMeta[],
  name: string,
  scope: MethodMeta['scope'],
  dataClass?: string
): MethodMeta | undefined {
  return methods.find(
    (m) =>
      m.name === name && m.scope === scope && (scope === 'catalog' || m.dataClass === dataClass)
  )
}

class OrdaQuery {
  constructor(
    private readonly client: RESTClient,
    private readonly builder: QueryBuilder,
    private readonly dataClass: string,
    private readonly methods: MethodMeta[]
  ) {}

  select(...attributes: string[]): OrdaQuery {
    const attrs = splitAttributes(...attributes)
    return new OrdaQuery(
      this.client,
      attrs.length > 0 ? this.builder.select(...attrs) : this.builder,
      this.dataClass,
      this.methods
    )
  }

  orderBy(attribute: string, direction?: 'asc' | 'desc'): OrdaQuery {
    return new OrdaQuery(
      this.client,
      this.builder.orderBy(attribute, direction),
      this.dataClass,
      this.methods
    )
  }

  expand(...relations: string[]): OrdaQuery {
    return new OrdaQuery(
      this.client,
      this.builder.expand(...relations),
      this.dataClass,
      this.methods
    )
  }

  top(n: number): OrdaQuery {
    return new OrdaQuery(this.client, this.builder.top(n), this.dataClass, this.methods)
  }

  limit(n: number): OrdaQuery {
    return this.top(n)
  }

  skip(n: number): OrdaQuery {
    return new OrdaQuery(this.client, this.builder.skip(n), this.dataClass, this.methods)
  }

  first(): Thenable<TerminalEntity | null> {
    return makeThenable(async () => {
      const entity = await this.builder.fetchOne()
      if (!entity || !isRecord(entity)) return null
      const dc = typeof entity.__DATACLASS === 'string' ? entity.__DATACLASS : this.dataClass
      return wrapEntity(entity, dc)
    })
  }

  toCollection(): Thenable<TerminalSelection> {
    return makeThenable(async () => {
      const collection = await this.builder.fetch()
      return wrapSelection(collection, this.dataClass)
    })
  }

  count(): Thenable<number> {
    return makeThenable(() => this.builder.count())
  }

  // biome-ignore lint/suspicious/noThenProperty: intentional thenable for await ds.Car.all()
  then(
    onFulfilled?: ((value: TerminalSelection) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) {
    return this.materialize().then(onFulfilled, onRejected)
  }

  catch(onRejected?: ((reason: unknown) => unknown) | null) {
    return this.materialize().catch(onRejected)
  }

  finally(onFinally?: (() => void) | null) {
    return this.materialize().finally(onFinally ?? undefined)
  }

  private async materialize(): Promise<TerminalSelection> {
    const ref = await this.builder.toEntitySet(ENTITY_SET_TIMEOUT_SEC)
    const options = this.builder.buildOptions()
    const { $method: _method, ...pageOptions } = options as Record<string, unknown> & {
      $method?: unknown
    }
    const collection = await this.client
      .dataclass(this.dataClass)
      .entitySet(ref.id)
      .fetch({
        ...pageOptions,
        $top: typeof pageOptions.$top === 'number' ? pageOptions.$top : PREVIEW_TOP,
      })
    const withSet: EntityCollection = {
      ...collection,
      __ENTITYSET: collection.__ENTITYSET ?? ref.uri,
      __COUNT: typeof collection.__COUNT === 'number' ? collection.__COUNT : ref.count,
      __entityModel: collection.__entityModel || this.dataClass,
    }
    return wrapSelection(withSet, this.dataClass)
  }
}

function createEntityHandle(
  client: RESTClient,
  dataClass: string,
  key: string | number,
  methods: MethodMeta[],
  attributes: string[] | null = null
) {
  const materialize = async (): Promise<TerminalEntity> => {
    const resource = client.dataclass(dataClass).entity(key)
    const entity =
      attributes && attributes.length > 0
        ? await resource.select(...attributes)
        : await resource.get()
    if (!isRecord(entity)) {
      throw new Error(`Entity ${dataClass}(${key}) returned a non-object payload`)
    }
    const dc = typeof entity.__DATACLASS === 'string' ? entity.__DATACLASS : dataClass
    return wrapEntity(entity, dc)
  }

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (isBlockedProxyProp(prop)) return undefined
        if (prop === 'then') {
          return (
            onFulfilled?: ((value: TerminalEntity) => unknown) | null,
            onRejected?: ((reason: unknown) => unknown) | null
          ) => materialize().then(onFulfilled, onRejected)
        }
        if (prop === 'catch') {
          return (onRejected?: ((reason: unknown) => unknown) | null) =>
            materialize().catch(onRejected)
        }
        if (prop === 'finally') {
          return (onFinally?: (() => void) | null) => materialize().finally(onFinally ?? undefined)
        }
        if (prop === 'select') {
          return (...attrs: string[]) =>
            createEntityHandle(client, dataClass, key, methods, splitAttributes(...attrs))
        }
        if (prop === 'getKey') {
          return () => String(key)
        }
        // Entity class function: ds.Car.entity(12).myMethod(...)
        return (...params: unknown[]) => {
          const meta = findMethod(methods, prop, 'entity', dataClass)
          return callEntityFunction(
            client.getHttpClient(),
            dataClass,
            key,
            prop,
            params,
            callOptions(meta)
          ).then((result) => normalizeMethodResult(result.unwrap(), dataClass))
        }
      },
    }
  )
}

function createSelHandle(
  client: RESTClient,
  dataClass: string,
  entitySetId: string,
  methods: MethodMeta[]
) {
  const materialize = async (): Promise<TerminalSelection> => {
    const collection = await client
      .dataclass(dataClass)
      .entitySet(entitySetId)
      .fetch({ $top: PREVIEW_TOP })
    return wrapSelection(
      {
        ...collection,
        __ENTITYSET: collection.__ENTITYSET ?? `/$entityset/${entitySetId}`,
        __entityModel: collection.__entityModel || dataClass,
      },
      dataClass
    )
  }

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (isBlockedProxyProp(prop)) return undefined
        if (prop === 'then') {
          return (
            onFulfilled?: ((value: TerminalSelection) => unknown) | null,
            onRejected?: ((reason: unknown) => unknown) | null
          ) => materialize().then(onFulfilled, onRejected)
        }
        if (prop === 'catch') {
          return (onRejected?: ((reason: unknown) => unknown) | null) =>
            materialize().catch(onRejected)
        }
        if (prop === 'finally') {
          return (onFinally?: (() => void) | null) => materialize().finally(onFinally ?? undefined)
        }
        if (prop === 'getKey') {
          return () => entitySetId
        }
        // Entity selection class function: ds.Car.sel(id).myMethod(...)
        return (...params: unknown[]) => {
          const meta = findMethod(methods, prop, 'entitySelection', dataClass)
          return callEntitySelectionFunction(
            client.getHttpClient(),
            dataClass,
            prop,
            params,
            callOptions(meta, entitySetId)
          ).then((result) => normalizeMethodResult(result.unwrap(), dataClass))
        }
      },
    }
  )
}

function createDataClassHandle(client: RESTClient, name: string, methods: MethodMeta[]) {
  const builtins = new Set(['all', 'query', 'get', 'entity', 'sel'])

  return new Proxy(
    {
      all(): OrdaQuery {
        return new OrdaQuery(client, client.dataclass(name).all(), name, methods)
      },
      query(filter: string, ...params: unknown[]): OrdaQuery {
        let builder = client.dataclass(name).filter(filter)
        if (params.length > 0) {
          builder = builder.params(...params)
        }
        return new OrdaQuery(client, builder, name, methods)
      },
      get(key: string | number) {
        return createEntityHandle(client, name, key, methods)
      },
      entity(key: string | number) {
        return createEntityHandle(client, name, key, methods)
      },
      sel(entitySetId: string) {
        return createSelHandle(client, name, String(entitySetId), methods)
      },
    },
    {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (prop === 'then') return undefined
        if (isBlockedProxyProp(prop)) return undefined
        if (Object.hasOwn(target, prop) || builtins.has(prop)) {
          return (target as Record<string, unknown>)[prop]
        }
        // Dataclass class function: ds.Car.myMethod(...)
        return (...params: unknown[]) => {
          const meta = findMethod(methods, prop, 'dataclass', name)
          return callDataClassFunction(
            client.getHttpClient(),
            name,
            prop,
            params,
            callOptions(meta)
          ).then((result) => normalizeMethodResult(result.unwrap(), name))
        }
      },
    }
  )
}

export type CreateDatastoreOptions = {
  /** When set, only these dataclass names are exposed as `ds.Name`. */
  dataClassNames?: string[]
  /** Exposed catalog methods for autocomplete + HTTP GET hints. */
  methods?: MethodMeta[]
  catalog?: CatalogAllResponse | null
}

function methodsFromCatalog(catalog: CatalogAllResponse | null | undefined): MethodMeta[] {
  if (!catalog) return []
  const next: MethodMeta[] = []
  for (const dataClass of catalog.dataClasses ?? []) {
    for (const method of dataClass.methods ?? []) {
      if (!isAssistantExposedMethod(method)) continue
      const applyTo = method.applyTo
      let scope: MethodMeta['scope'] = 'dataclass'
      if (applyTo === 'entity') scope = 'entity'
      else if (
        applyTo === 'entitySelection' ||
        applyTo === 'entityCollection' ||
        applyTo === 'dataClassSelection'
      ) {
        scope = 'entitySelection'
      }
      next.push({
        name: method.name,
        scope,
        dataClass: dataClass.name,
        allowedOnHTTPGET: method.allowedOnHTTPGET,
      })
    }
  }
  const full = catalog as CatalogAllResponse & {
    methods?: Array<{
      name: string
      applyTo?: string
      allowedOnHTTPGET?: boolean
      exposed?: boolean
      scope?: string
    }>
  }
  for (const method of full.methods ?? []) {
    if (!isAssistantExposedMethod(method)) continue
    next.push({
      name: method.name,
      scope: 'catalog',
      allowedOnHTTPGET: method.allowedOnHTTPGET,
    })
  }
  return next
}

/**
 * Build an ORDA-style `ds` facade over a RESTClient.
 *
 * - `ds.method(...)` — datastore (catalog) functions
 * - `ds.Car.all()` / `.query()` / `.get(key)` — queries
 * - `ds.Car.method(...)` — dataclass functions
 * - `ds.Car.entity(key).method(...)` — entity functions
 * - `ds.Car.sel(id).method(...)` — entity-selection functions
 */
export function createDatastore(
  client: RESTClient,
  options: CreateDatastoreOptions = {}
): Record<string, unknown> {
  const dataClassNames =
    options.dataClassNames && options.dataClassNames.length > 0
      ? new Set(options.dataClassNames)
      : null
  const methods = options.methods ?? methodsFromCatalog(options.catalog)
  const catalogMethodNames = new Set(
    methods.filter((m) => m.scope === 'catalog').map((m) => m.name)
  )

  const isDataClassName = (name: string): boolean => {
    if (dataClassNames) return dataClassNames.has(name)
    if (catalogMethodNames.has(name)) return false
    return /^[A-Z]/.test(name)
  }

  const callCatalogMethod = (name: string) => {
    return (...params: unknown[]) => {
      const meta = findMethod(methods, name, 'catalog')
      return callDataStoreFunction(client.getHttpClient(), name, params, callOptions(meta)).then(
        (result) => normalizeMethodResult(result.unwrap())
      )
    }
  }

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (prop === 'then') return undefined
        if (isBlockedProxyProp(prop)) return undefined

        if (isDataClassName(prop)) {
          return createDataClassHandle(client, prop, methods)
        }

        return callCatalogMethod(prop)
      },
      has(_target, prop) {
        if (typeof prop === 'symbol') return false
        return typeof prop === 'string'
      },
      ownKeys() {
        const keys = new Set<string>()
        if (dataClassNames) for (const n of dataClassNames) keys.add(n)
        for (const n of catalogMethodNames) keys.add(n)
        return [...keys]
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== 'string') return undefined
        return {
          configurable: true,
          enumerable: true,
          writable: false,
          value: isDataClassName(prop)
            ? createDataClassHandle(client, prop, methods)
            : callCatalogMethod(prop),
        }
      },
    }
  ) as Record<string, unknown>
}
