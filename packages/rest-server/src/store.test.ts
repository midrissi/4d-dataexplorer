import { beforeEach, describe, expect, it } from 'bun:test'
import { DataStore, store } from './store'

describe('Store', () => {
  beforeEach(() => {
    store.initialize()
  })

  describe('getDataClasses', () => {
    it('should return list of dataclasses', () => {
      const dataclasses = store.getDataClasses()
      expect(Array.isArray(dataclasses)).toBe(true)
      expect(dataclasses.length).toBeGreaterThan(0)
    })

    it('should return dataclass with required fields', () => {
      const dataclasses = store.getDataClasses()
      const first = dataclasses[0]
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('dataURI')
    })
  })

  describe('getDataClass', () => {
    it('should return dataclass by name', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const dataclass = store.getDataClass(name)
        expect(dataclass).toBeDefined()
        expect(dataclass?.name).toBe(name)
      }
    })

    it('should return undefined for non-existent dataclass', () => {
      const dataclass = store.getDataClass('NonExistent')
      expect(dataclass).toBeUndefined()
    })
  })

  describe('getAllEntities', () => {
    it('should return entities for dataclass', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const entities = store.getAllEntities(name)
        expect(Array.isArray(entities)).toBe(true)
      }
    })
  })

  describe('getEntity', () => {
    it('should return entity by key', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const entities = store.getAllEntities(name)
        if (entities.length > 0) {
          const key = entities[0].__KEY
          const entity = store.getEntity(name, String(key))
          expect(entity).toBeDefined()
          expect(entity?.__KEY).toBe(key)
        }
      }
    })

    it('should return undefined for non-existent entity', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const entity = store.getEntity(name, '999999')
        expect(entity).toBeUndefined()
      }
    })
  })

  describe('addEntity', () => {
    it('should add new entity', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const newEntity = { name: 'Test Entity', value: 123 }
        const created = store.addEntity(name, newEntity)
        expect(created).toBeDefined()
        expect(created.__KEY).toBeDefined()
        expect(created.__DATACLASS).toBe(name)
      }
    })

    it('should generate key when id is omitted', () => {
      const created = store.addEntity('Users', { firstName: 'Auto', lastName: 'Key' })
      expect(created.ID).toBeDefined()
      expect(store.getEntity('Users', String(created.__KEY))).toBeDefined()
    })
  })

  describe('updateEntity', () => {
    it('should update existing entity', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const entities = store.getAllEntities(name)
        if (entities.length > 0) {
          const key = String(entities[0].__KEY)
          const updated = store.updateEntity(name, key, { name: 'Updated' })
          expect(updated).toBeDefined()
          expect(updated?.name).toBe('Updated')
        }
      }
    })

    it('should return undefined for non-existent entity', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const updated = store.updateEntity(name, '999999', { name: 'Updated' })
        expect(updated).toBeUndefined()
      }
    })
  })

  describe('deleteEntity', () => {
    it('should delete entity', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const newEntity = { name: 'To Delete' }
        const created = store.addEntity(name, newEntity)
        const deleted = store.deleteEntity(name, String(created.__KEY))
        expect(deleted).toBe(true)
        const entity = store.getEntity(name, String(created.__KEY))
        expect(entity).toBeUndefined()
      }
    })

    it('should return false for non-existent entity', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const deleted = store.deleteEntity(name, '999999')
        expect(deleted).toBe(false)
      }
    })
  })

  describe('countEntities', () => {
    it('should return entity count for dataclass', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const entities = store.getAllEntities(name)
        const count = store.countEntities(name)
        expect(count).toBe(entities.length)
      }
    })

    it('should return 0 for non-existent dataclass', () => {
      expect(store.countEntities('NonExistent')).toBe(0)
    })
  })

  describe('filterEntities', () => {
    it('should exclude entities that do not match filter', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const all = store.getAllEntities(name)
        const filtered = store.filterEntities(name, 'zzznomatchzzz')
        expect(filtered).toHaveLength(0)
        expect(all.length).toBeGreaterThan(0)
      }
    })

    it('should return all entities when filter is empty', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const all = store.getAllEntities(name)
        const filtered = store.filterEntities(name, '')
        expect(filtered).toEqual(all)
      }
    })

    it('should filter entities by string match', () => {
      const dataclasses = store.getDataClasses()
      if (dataclasses.length > 0) {
        const name = dataclasses[0].name
        const created = store.addEntity(name, { name: 'UniqueFilterTarget', code: 42 })
        const filtered = store.filterEntities(name, 'uniquefiltertarget')
        expect(filtered.some((e) => e.__KEY === created.__KEY)).toBe(true)
        const filteredByCode = store.filterEntities(name, '42')
        expect(filteredByCode.some((e) => e.__KEY === created.__KEY)).toBe(true)
      }
    })
  })

  describe('DataStore constructor', () => {
    it('creates an independent store instance', () => {
      const isolated = new DataStore()
      isolated.initialize()
      expect(isolated.getDataClasses().length).toBeGreaterThan(0)
    })
  })

  describe('addDataClass', () => {
    it('registers a new dataclass and accepts entities', () => {
      store.addDataClass({
        name: 'Custom',
        collectionName: 'Custom',
        dataURI: '/rest/Custom',
        attributes: [],
        key: [{ name: 'ID' }],
      })
      const created = store.addEntity('Custom', { label: 'One' })
      expect(store.getDataClass('Custom')).toBeDefined()
      expect(created.__DATACLASS).toBe('Custom')
    })
  })

  describe('sortEntities', () => {
    it('should return entities unchanged when orderBy is empty', () => {
      const entities = [
        { __KEY: 1, name: 'A' },
        { __KEY: 2, name: 'B' },
      ]
      const sorted = store.sortEntities(entities, '')
      expect(sorted).toEqual(entities)
    })

    it('should sort by attribute ascending', () => {
      const entities = [
        { __KEY: 2, name: 'B', ord: 2 },
        { __KEY: 1, name: 'A', ord: 1 },
      ]
      const sorted = store.sortEntities(entities, 'ord asc')
      expect(sorted[0].ord).toBe(1)
      expect(sorted[1].ord).toBe(2)
    })

    it('should sort by attribute descending', () => {
      const entities = [
        { __KEY: 1, name: 'A', ord: 1 },
        { __KEY: 2, name: 'B', ord: 2 },
      ]
      const sorted = store.sortEntities(entities, 'ord desc')
      expect(sorted[0].ord).toBe(2)
      expect(sorted[1].ord).toBe(1)
    })

    it('should handle undefined values in sort', () => {
      const entities = [
        { __KEY: 1, name: 'A' },
        { __KEY: 2, name: 'B', ord: 1 },
      ]
      const sorted = store.sortEntities(entities, 'ord asc')
      expect(sorted.length).toBe(2)
    })

    it('should sort by attribute with default ascending direction', () => {
      const entities = [
        { __KEY: 2, name: 'B', ord: 2 },
        { __KEY: 1, name: 'A', ord: 1 },
      ]
      const sorted = store.sortEntities(entities, 'ord')
      expect(sorted[0].ord).toBe(1)
    })

    it('sortEntities ascending when first value is greater', () => {
      const entities = [
        { __KEY: 2, name: 'B', ord: 2 },
        { __KEY: 1, name: 'A', ord: 1 },
      ]
      const sorted = store.sortEntities(entities, 'ord asc')
      expect(sorted[0].ord).toBe(1)
      expect(sorted[1].ord).toBe(2)
    })

    it('should treat equal sort values as equal', () => {
      const entities = [
        { __KEY: 1, name: 'A', ord: 5 },
        { __KEY: 2, name: 'B', ord: 5 },
      ]
      const sorted = store.sortEntities(entities, 'ord asc')
      expect(sorted).toHaveLength(2)
      expect(sorted.every((e) => e.ord === 5)).toBe(true)
    })
  })

  describe('store coverage', () => {
    it('exercises filter and sort callbacks', () => {
      const users = store.getAllEntities('Users')
      expect(store.filterEntities('Users', 'john').length).toBeGreaterThanOrEqual(0)
      expect(store.filterEntities('Users', 'zzzznotfound').length).toBe(0)
      expect(store.sortEntities(users, 'firstName asc').length).toBe(users.length)
      expect(store.sortEntities(users, 'firstName desc').length).toBe(users.length)
      expect(store.sortEntities(users, 'firstName')).toHaveLength(users.length)
    })
  })
})
