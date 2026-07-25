import path from 'node:path'
import { Elysia } from 'elysia'
import { serveStatic } from './static-server'
import { store } from './store'
import type { Entity, EntityCollection, EntityMutationResult } from './types'

// Initialize store with sample data
store.initialize()

const MOCK_CATALOG_UNIQID = 'mock-catalog-id'
const MOCK_CATALOG_BASEID = 'mock-base-id'

// Helper function to set CORS headers
const setCorsHeaders = (set: { headers: Record<string, string | number | undefined> }) => {
  set.headers['Access-Control-Allow-Origin'] = '*'
  set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
}

// Path to DataBrowser build output
// __dirname is packages/rest-server/src, so we need to go up 3 levels to reach project root
const projectRoot = path.resolve(__dirname, '../../..')
const dataBrowserPath = path.resolve(projectRoot, 'apps/dataexplorer/DataBrowser')

const staticFileHandler = serveStatic(dataBrowserPath, '/dataexplorer/')

const app = new Elysia()
  // Serve static files for /dataexplorer/* - catch-all route
  .get('/dataexplorer/*', async (context) => {
    const response = await staticFileHandler(context)
    if (response) {
      return response
    }
    // If no file found, return 404
    return new Response('Not Found', { status: 404 })
  })
  // Also handle /dataexplorer without trailing path
  .get('/dataexplorer', async (context) => {
    const response = await staticFileHandler(context)
    if (response) {
      return response
    }
    return new Response('Not Found', { status: 404 })
  })
  // Handle OPTIONS requests
  .options('/*', ({ set }) => {
    setCorsHeaders(set)
    set.status = 204
    return ''
  })
  /**
   * GET /rest/$catalog
   * Returns list of dataclasses
   */
  .get('/rest/$catalog', ({ set }) => {
    setCorsHeaders(set)
    const dataclasses = store.getDataClasses()
    return {
      __UNIQID: MOCK_CATALOG_UNIQID,
      __BASEID: MOCK_CATALOG_BASEID,
      dataClasses: dataclasses.map((dc) => ({
        name: dc.name,
        uri: `/rest/${dc.name}`,
        dataURI: dc.dataURI,
      })),
      singletons: [],
    }
  })

  /**
   * GET /rest/$catalog/$all
   * Returns full catalog with attributes
   */
  .get('/rest/$catalog/$all', ({ set }) => {
    setCorsHeaders(set)
    return {
      __UNIQID: MOCK_CATALOG_UNIQID,
      __BASEID: MOCK_CATALOG_BASEID,
      dataClasses: store.getDataClasses(),
      singletons: [],
    }
  })
  /**
   * GET /rest/$catalog/:name
   * Returns specific dataclass definition
   */
  .get('/rest/$catalog/:name', ({ params, set }) => {
    setCorsHeaders(set)
    const dataclass = store.getDataClass(params.name)
    if (!dataclass) {
      return { error: `Dataclass ${params.name} not found` }
    }
    return dataclass
  })
  /**
   * GET /rest/:dataclassName
   * Query entities with optional filters, pagination, etc.
   */
  .get('/rest/:dataclassName', ({ params, query, set }) => {
    setCorsHeaders(set)
    const { dataclassName } = params
    const dataclass = store.getDataClass(dataclassName)
    if (!dataclass) {
      set.status = 404
      return { error: `Dataclass ${dataclassName} not found` }
    }

    let entities = store.getAllEntities(dataclassName)

    // Apply filter if provided
    if (query.$filter) {
      entities = store.filterEntities(dataclassName, query.$filter as string)
    }

    // Apply sorting if provided
    if (query.$orderby) {
      entities = store.sortEntities(entities, query.$orderby as string)
    }

    const total = entities.length
    const top = query.$top ? Number(query.$top) : total
    const skip = query.$skip ? Number(query.$skip) : 0

    // Apply pagination
    const paginatedEntities = entities.slice(skip, skip + top)

    // Apply attribute selection if provided
    let selectedEntities = paginatedEntities
    if (query.$attributes) {
      const attrs = (query.$attributes as string).split(',').map((a) => a.trim())
      selectedEntities = paginatedEntities.map((entity) => {
        const selected: Entity = {
          __KEY: entity.__KEY,
          __STAMP: entity.__STAMP,
          __TIMESTAMP: entity.__TIMESTAMP,
          __DATACLASS: entity.__DATACLASS,
        }
        for (const attr of attrs) {
          if (attr in entity) {
            selected[attr] = entity[attr]
          }
        }
        return selected
      })
    }

    const result: EntityCollection = {
      __entityModel: dataclassName,
      __COUNT: total,
      __SENT: selectedEntities.length,
      __FIRST: skip,
      __ENTITIES: selectedEntities,
    }

    // If $count=true, return just the count
    if (query.$count === 'true') {
      return total
    }

    return result
  })
  /**
   * GET /rest/:dataclassName(:key)
   * Get a single entity by key
   * Handles OData-style keys like /rest/Users(1)
   */
  .get('/rest/:dataclassName/*', ({ params, path, set }) => {
    setCorsHeaders(set)
    const { dataclassName } = params
    const dataclass = store.getDataClass(dataclassName)
    if (!dataclass) {
      set.status = 404
      return { error: `Dataclass ${dataclassName} not found` }
    }

    // Extract key from path like "/rest/Users(1)" -> "1"
    const keyMatch = path.match(/\(([^)]+)\)$/)
    if (!keyMatch) {
      set.status = 400
      return { error: 'Invalid key format' }
    }

    const key = keyMatch[1]
    const entity = store.getEntity(dataclassName, key)
    if (!entity) {
      set.status = 404
      return { error: `Entity ${key} not found in ${dataclassName}` }
    }

    return {
      ...entity,
      __entityModel: dataclassName,
      uri: `/rest/${dataclassName}(${key})`,
    }
  })

  /**
   * POST /rest/:dataclassName
   * Create or update entities
   */
  .post('/rest/:dataclassName', async ({ params, body, query, set }) => {
    setCorsHeaders(set)
    const { dataclassName } = params
    const dataclass = store.getDataClass(dataclassName)
    if (!dataclass) {
      set.status = 404
      return { error: `Dataclass ${dataclassName} not found` }
    }

    const method = query.$method as string | undefined

    // Handle delete method
    if (method === 'delete') {
      // This is handled by the DELETE route below
      set.status = 400
      return { error: 'Use DELETE method instead' }
    }

    // Handle update method
    if (method === 'update') {
      const data = body as Entity | Entity[]
      const keyAttr = dataclass.key?.[0]?.name || 'ID'

      if (Array.isArray(data)) {
        // Batch update
        const results: EntityMutationResult[] = []
        for (const item of data) {
          const key = String(item.__KEY || item[keyAttr])
          const updated = store.updateEntity(dataclassName, key, item)
          if (updated) {
            results.push({
              ...updated,
              __entityModel: dataclassName,
              uri: `/rest/${dataclassName}(${key})`,
              __STATUS: {
                status: 200,
                statusText: 'OK',
                success: true,
              },
            })
          }
        }
        return results
      } else {
        // Single update
        const key = String(data.__KEY || data[keyAttr])
        const updated = store.updateEntity(dataclassName, key, data)
        if (!updated) {
          set.status = 404
          return { error: `Entity ${key} not found` }
        }
        return {
          ...updated,
          __entityModel: dataclassName,
          uri: `/rest/${dataclassName}(${key})`,
          __STATUS: {
            status: 200,
            statusText: 'OK',
            success: true,
          },
        }
      }
    }

    // Handle create (no method specified)
    const data = body as Record<string, unknown> | Record<string, unknown>[]
    if (Array.isArray(data)) {
      // Batch create
      const results: EntityMutationResult[] = []
      for (const item of data) {
        const created = store.addEntity(dataclassName, item)
        results.push({
          ...created,
          __entityModel: dataclassName,
          uri: `/rest/${dataclassName}(${created.__KEY})`,
          __STATUS: {
            status: 201,
            statusText: 'Created',
            success: true,
          },
        })
      }
      return results
    } else {
      // Single create
      const created = store.addEntity(dataclassName, data)
      return {
        ...created,
        __entityModel: dataclassName,
        uri: `/rest/${dataclassName}(${created.__KEY})`,
        __STATUS: {
          status: 201,
          statusText: 'Created',
          success: true,
        },
      }
    }
  })
  /**
   * POST /rest/:dataclassName(:key) with $method=delete
   * Delete an entity
   * Handles OData-style keys like /rest/Users(1)
   */
  .post('/rest/:dataclassName/*', ({ params, path, query, set }) => {
    setCorsHeaders(set)
    const { dataclassName } = params
    const method = query.$method as string | undefined

    if (method === 'delete') {
      // Extract key from path like "/rest/Users(1)" -> "1"
      const keyMatch = path.match(/\(([^)]+)\)$/)
      if (!keyMatch) {
        set.status = 400
        return { error: 'Invalid key format' }
      }

      const key = keyMatch[1]
      const deleted = store.deleteEntity(dataclassName, key)
      if (!deleted) {
        set.status = 404
        return { error: `Entity ${key} not found` }
      }
      return { ok: true }
    }

    set.status = 400
    return { error: 'Invalid method' }
  })
  /**
   * POST /api/login
   * Login endpoint (multipart form data)
   */
  .post('/api/login', async ({ body, set }) => {
    setCorsHeaders(set)
    // Handle multipart form data or JSON
    let accessKey: string | null = null

    if (body instanceof FormData) {
      accessKey = (body.get('accessKey') as string) || null
    } else if (body && typeof body === 'object') {
      // Handle JSON body or parsed form data
      const data = body as Record<string, unknown>
      accessKey = (data.accessKey as string) || null
    }

    // Simple validation: accessKey "123" is valid
    if (accessKey === '123') {
      return {
        success: true,
        isLogged: true,
      }
    }

    set.status = 200 // API returns 200 even for invalid keys
    return {
      success: true,
      isLogged: false,
      errors: ['Invalid Access key'],
    }
  })
  // Health check
  .get('/health', ({ set }) => {
    setCorsHeaders(set)
    return { status: 'ok' }
  })

const port = Number(process.env.PORT) || 7080

app.listen(
  {
    port,
    hostname: '0.0.0.0',
  },
  () => {
    console.log(`🚀 REST Server running on http://localhost:${port}`)
    console.log(`📱 Data Explorer: http://localhost:${port}/dataexplorer/`)
    console.log(`📚 Catalog: http://localhost:${port}/rest/$catalog`)
    console.log(`🔐 Login: http://localhost:${port}/api/login`)
  }
)

export default app
