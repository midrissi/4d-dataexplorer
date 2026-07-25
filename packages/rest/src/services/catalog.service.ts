import type { HttpClient } from '../core/http-client'
import type {
  CatalogAllMetadataResponse,
  CatalogAllResponse,
  CatalogResponse,
  DataClass,
  Singleton,
} from '../types'

/**
 * Service for $catalog operations
 */
/** Full catalog with metadata and expanded DataClass[] (for apps that need both) */
export type CatalogWithMetadataExpanded = Omit<CatalogAllMetadataResponse, 'dataClasses'> & {
  dataClasses: DataClass[]
}

export class CatalogService {
  private readonly http: HttpClient
  private cache: CatalogAllResponse | null = null
  private cacheWithMetadata: CatalogWithMetadataExpanded | null = null

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Get list of dataclasses (basic info)
   */
  async getDataClasses(): Promise<CatalogResponse> {
    return this.http.get<CatalogResponse>('/$catalog')
  }

  /**
   * Get full catalog with all dataclass definitions.
   * Use `{ metadata: 'full' }` to request full metadata (__UNIQID, __BASEID, __NAME, properties, singleton method details, datastore methods).
   */
  async getAll(): Promise<CatalogAllResponse>
  async getAll(options: { metadata: 'full' }): Promise<CatalogAllMetadataResponse>
  async getAll(options?: {
    metadata?: 'full'
  }): Promise<CatalogAllResponse | CatalogAllMetadataResponse> {
    const params = options?.metadata === 'full' ? { $metadata: 'full' } : undefined
    return this.http.get<CatalogAllResponse | CatalogAllMetadataResponse>('/$catalog/$all', params)
  }

  /**
   * Get full catalog (cached)
   */
  async getAllCached(): Promise<CatalogAllResponse> {
    if (!this.cache) {
      this.cache = await this.getAll()
    }
    return this.cache
  }

  /**
   * Get full catalog with metadata (cached).
   * Fetches $catalog/$all?$metadata=full, which already returns each dataClass
   * with its attributes. Only dataClasses returned in short form (no inline
   * attributes) are expanded via $catalog/{name}, so a single request is enough
   * on servers that include attributes in $all.
   * Returns metadata (__UNIQID, __BASEID, __NAME, properties, singletons, methods) and full dataClasses with attributes.
   */
  async getAllWithMetadataCached(): Promise<CatalogWithMetadataExpanded> {
    if (!this.cacheWithMetadata) {
      const meta = await this.getAll({ metadata: 'full' })
      const refs = Array.isArray(meta.dataClasses) ? meta.dataClasses : []
      const dataClasses = await Promise.all(
        refs.map(async (dc) => {
          const inline = dc as unknown as DataClass
          // $catalog/$all?$metadata=full already includes each dataClass's
          // attributes; only fall back to a per-dataclass request when the
          // server returned the short form (name/uri/dataURI without attributes).
          const raw =
            Array.isArray(inline.attributes) && inline.attributes.length > 0
              ? inline
              : await this.fetchDataClassFull(dc.name)
          const name = raw.name ?? raw.className ?? dc.name
          const attributes = Array.isArray(raw.attributes) ? raw.attributes : []
          const key = raw.key != null ? (Array.isArray(raw.key) ? raw.key : []) : undefined
          return { ...raw, name, attributes, ...(key !== undefined && { key }) }
        })
      )
      this.cacheWithMetadata = { ...meta, dataClasses }
    }
    return this.cacheWithMetadata
  }

  /**
   * Fetch a single dataclass with full metadata, normalizing servers that return
   * the whole catalog for GET /$catalog/{name} (extract the matching dataclass so
   * we get its attributes and methods, not root-level methods like authentify).
   */
  private async fetchDataClassFull(name: string): Promise<DataClass> {
    const full = await this.getDataClass(name, { metadata: 'full' })
    const fullAny = full as unknown as Record<string, unknown>
    const allClasses = Array.isArray(fullAny.dataClasses)
      ? (fullAny.dataClasses as DataClass[])
      : null
    return allClasses?.find((d) => (d.name ?? d.className) === name) ?? full
  }

  /**
   * Clear the catalog cache
   */
  clearCache(): void {
    this.cache = null
    this.cacheWithMetadata = null
  }

  /**
   * Get a specific dataclass definition.
   * Use options.metadata === 'full' to request full method metadata (e.g. paramsText/signature).
   */
  async getDataClass(name: string, options?: { metadata?: 'full' }): Promise<DataClass> {
    const params = options?.metadata === 'full' ? { $metadata: 'full' } : undefined
    return this.http.get<DataClass>(`/$catalog/${name}`, params)
  }

  /**
   * Get all singletons
   */
  async getSingletons(): Promise<Singleton[]> {
    const catalog = await this.getAll()
    return catalog.singletons ?? []
  }

  /**
   * Get dataclass names
   */
  async getDataClassNames(): Promise<string[]> {
    const catalog = await this.getDataClasses()
    return catalog.dataClasses.map((dc) => dc.name)
  }

  /**
   * Check if a dataclass exists
   */
  async hasDataClass(name: string): Promise<boolean> {
    const names = await this.getDataClassNames()
    return names.includes(name)
  }

  /**
   * Get dataclass attribute names
   */
  async getAttributeNames(dataClassName: string): Promise<string[]> {
    const dataClass = await this.getDataClass(dataClassName)
    return dataClass.attributes.map((attr) => attr.name)
  }

  /**
   * Get dataclass primary key attribute name
   */
  async getPrimaryKey(dataClassName: string): Promise<string | undefined> {
    const dataClass = await this.getDataClass(dataClassName)
    return dataClass.key?.[0]?.name
  }
}
