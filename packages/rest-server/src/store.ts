import type { DataClass, Entity } from './types'

/**
 * In-memory data store for the mock REST server
 */
export class DataStore {
  private dataclasses: Map<string, DataClass>
  private entities: Map<string, Map<string, Entity>>
  private nextKeys: Map<string, number>
  private nextStamps: Map<string, number>

  constructor() {
    this.dataclasses = new Map()
    this.entities = new Map()
    this.nextKeys = new Map()
    this.nextStamps = new Map()
  }

  /**
   * Initialize with sample dataclasses
   */
  initialize() {
    // Sample dataclasses
    const users: DataClass = {
      name: 'Users',
      collectionName: 'Users',
      dataURI: '/rest/Users',
      attributes: [
        {
          name: 'ID',
          kind: 'storage',
          type: 'long',
          indexed: true,
          unique: true,
          identifying: true,
        },
        { name: 'firstName', kind: 'storage', type: 'string', indexed: true },
        { name: 'lastName', kind: 'storage', type: 'string', indexed: true },
        { name: 'email', kind: 'storage', type: 'string', indexed: true, unique: true },
        { name: 'age', kind: 'storage', type: 'long' },
        { name: 'createdAt', kind: 'storage', type: 'date' },
      ],
      key: [{ name: 'ID' }],
    }

    const products: DataClass = {
      name: 'Products',
      collectionName: 'Products',
      dataURI: '/rest/Products',
      attributes: [
        {
          name: 'ID',
          kind: 'storage',
          type: 'long',
          indexed: true,
          unique: true,
          identifying: true,
        },
        { name: 'name', kind: 'storage', type: 'string', indexed: true },
        { name: 'price', kind: 'storage', type: 'number' },
        { name: 'description', kind: 'storage', type: 'string', multiLine: true },
        { name: 'stock', kind: 'storage', type: 'long' },
      ],
      key: [{ name: 'ID' }],
    }

    const orders: DataClass = {
      name: 'Orders',
      collectionName: 'Orders',
      dataURI: '/rest/Orders',
      attributes: [
        {
          name: 'ID',
          kind: 'storage',
          type: 'long',
          indexed: true,
          unique: true,
          identifying: true,
        },
        { name: 'orderNumber', kind: 'storage', type: 'string', indexed: true, unique: true },
        { name: 'userId', kind: 'storage', type: 'long' },
        { name: 'total', kind: 'storage', type: 'number' },
        { name: 'status', kind: 'storage', type: 'string' },
        { name: 'createdAt', kind: 'storage', type: 'date' },
      ],
      key: [{ name: 'ID' }],
    }

    this.addDataClass(users)
    this.addDataClass(products)
    this.addDataClass(orders)

    // Add sample entities
    this.addEntity('Users', {
      ID: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      age: 30,
      createdAt: new Date().toISOString(),
    })

    this.addEntity('Users', {
      ID: 2,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      age: 25,
      createdAt: new Date().toISOString(),
    })

    this.addEntity('Products', {
      ID: 1,
      name: 'Laptop',
      price: 999.99,
      description: 'High-performance laptop',
      stock: 50,
    })

    this.addEntity('Products', {
      ID: 2,
      name: 'Mouse',
      price: 29.99,
      description: 'Wireless mouse',
      stock: 100,
    })

    this.addEntity('Orders', {
      ID: 1,
      orderNumber: 'ORD-001',
      userId: 1,
      total: 1029.98,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  }

  /**
   * Add a dataclass definition
   */
  addDataClass(dataclass: DataClass) {
    this.dataclasses.set(dataclass.name, dataclass)
    this.entities.set(dataclass.name, new Map())
    this.nextKeys.set(dataclass.name, 1)
    this.nextStamps.set(dataclass.name, 1)
  }

  /**
   * Get all dataclasses
   */
  getDataClasses(): DataClass[] {
    return Array.from(this.dataclasses.values())
  }

  /**
   * Get a dataclass by name
   */
  getDataClass(name: string): DataClass | undefined {
    return this.dataclasses.get(name)
  }

  /**
   * Add an entity to a dataclass
   */
  addEntity(dataclassName: string, data: Record<string, unknown>): Entity {
    const dataclass = this.dataclasses.get(dataclassName)
    if (!dataclass) {
      throw new Error(`Dataclass ${dataclassName} not found`)
    }

    const keyAttr = dataclass.key?.[0]?.name || 'ID'
    let key: string

    // Generate key if not provided
    if (data[keyAttr] === undefined) {
      const nextKey = this.nextKeys.get(dataclassName) || 1
      key = String(nextKey)
      this.nextKeys.set(dataclassName, nextKey + 1)
      data[keyAttr] = Number(key)
    } else {
      key = String(data[keyAttr])
    }

    const stamp = this.nextStamps.get(dataclassName) || 1
    this.nextStamps.set(dataclassName, stamp + 1)

    const entity: Entity = {
      __KEY: key,
      __STAMP: stamp,
      __TIMESTAMP: new Date().toISOString(),
      __DATACLASS: dataclassName,
      ...data,
    }

    const entityMap = this.entities.get(dataclassName)
    if (entityMap) {
      entityMap.set(key, entity)
    }

    return entity
  }

  /**
   * Get an entity by key
   */
  getEntity(dataclassName: string, key: string): Entity | undefined {
    return this.entities.get(dataclassName)?.get(key)
  }

  /**
   * Get all entities for a dataclass
   */
  getAllEntities(dataclassName: string): Entity[] {
    const entityMap = this.entities.get(dataclassName)
    return entityMap ? Array.from(entityMap.values()) : []
  }

  /**
   * Update an entity
   */
  updateEntity(dataclassName: string, key: string, data: Partial<Entity>): Entity | undefined {
    const entityMap = this.entities.get(dataclassName)
    const entity = entityMap?.get(key)
    if (!entity) {
      return undefined
    }

    const updated = {
      ...entity,
      ...data,
      __KEY: key, // Preserve key
      __STAMP: (entity.__STAMP || 0) + 1, // Increment stamp
      __TIMESTAMP: new Date().toISOString(),
    }

    entityMap?.set(key, updated)
    return updated
  }

  /**
   * Delete an entity
   */
  deleteEntity(dataclassName: string, key: string): boolean {
    const entityMap = this.entities.get(dataclassName)
    return entityMap?.delete(key) || false
  }

  /**
   * Count entities in a dataclass
   */
  countEntities(dataclassName: string): number {
    return this.entities.get(dataclassName)?.size || 0
  }

  /**
   * Filter entities (simple string matching for demo)
   */
  filterEntities(dataclassName: string, filter: string): Entity[] {
    const all = this.getAllEntities(dataclassName)
    if (!filter) return all

    // Simple filter implementation - in real 4D this would parse the filter expression
    // For demo, we'll do basic string matching
    return all.filter((entity) => {
      const entityStr = JSON.stringify(entity).toLowerCase()
      return entityStr.includes(filter.toLowerCase())
    })
  }

  /**
   * Sort entities
   */
  sortEntities(entities: Entity[], orderBy: string): Entity[] {
    if (!orderBy) return entities

    const [attr, direction] = orderBy.split(' ').filter(Boolean)
    const dir = direction?.toLowerCase() === 'desc' ? -1 : 1

    return [...entities].sort((a, b) => {
      const aVal = a[attr]
      const bVal = b[attr]
      if (aVal === bVal) return 0
      if (aVal === undefined) return 1
      if (bVal === undefined) return -1
      return (aVal ?? 0) > (bVal ?? 0) ? dir : -dir
    })
  }
}

export const store = new DataStore()
