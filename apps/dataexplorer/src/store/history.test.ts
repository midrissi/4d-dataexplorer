import { beforeEach, describe, expect, it } from 'bun:test'
import { useHistoryStore } from './history'
import type { QueryOptions } from './tabs'

const defaultQuery: QueryOptions = {
  filter: '',
  filterParams: [],
  sort: '__KEY',
  order: 'desc',
  select: '',
  top: 100,
}

const customQuery: QueryOptions = {
  filter: 'name = "test"',
  filterParams: [],
  sort: 'name',
  order: 'asc',
  select: 'name,id',
  top: 50,
}

describe('store/history', () => {
  beforeEach(() => {
    useHistoryStore.setState({ history: {} })
  })

  describe('addToHistory', () => {
    it('adds a non-default query to history', () => {
      const dataclass = 'TestClass'
      useHistoryStore.getState().addToHistory(dataclass, customQuery, 10)
      const history = useHistoryStore.getState().getHistory(dataclass)
      expect(history).toHaveLength(1)
      expect(history[0]?.query.filter).toBe(customQuery.filter)
      expect(history[0]?.resultsCount).toBe(10)
    })

    it('does not add default/empty query', () => {
      const dataclass = 'TestClass'
      useHistoryStore.getState().addToHistory(dataclass, defaultQuery)
      const history = useHistoryStore.getState().getHistory(dataclass)
      expect(history).toHaveLength(0)
    })

    it('does not add duplicate of last query', () => {
      const dataclass = 'TestClass'
      useHistoryStore.getState().addToHistory(dataclass, customQuery)
      useHistoryStore.getState().addToHistory(dataclass, customQuery)
      const history = useHistoryStore.getState().getHistory(dataclass)
      expect(history).toHaveLength(1)
    })

    it('adds when query differs from last', () => {
      const dataclass = 'TestClass'
      useHistoryStore.getState().addToHistory(dataclass, customQuery)
      useHistoryStore.getState().addToHistory(dataclass, {
        ...customQuery,
        filter: 'other',
      })
      const history = useHistoryStore.getState().getHistory(dataclass)
      expect(history).toHaveLength(2)
    })
  })

  describe('getHistory', () => {
    it('returns empty array for dataclass with no history', () => {
      expect(useHistoryStore.getState().getHistory('None')).toEqual([])
    })
  })

  describe('removeFromHistory', () => {
    it('removes item by id', () => {
      const dataclass = 'TestClass'
      useHistoryStore.getState().addToHistory(dataclass, customQuery)
      const history = useHistoryStore.getState().getHistory(dataclass)
      const id = history[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useHistoryStore.getState().removeFromHistory(dataclass, id)
      }
      expect(useHistoryStore.getState().getHistory(dataclass)).toHaveLength(0)
    })
  })

  describe('clearHistory', () => {
    it('clears history for dataclass', () => {
      const dataclass = 'TestClass'
      useHistoryStore.getState().addToHistory(dataclass, customQuery)
      useHistoryStore.getState().clearHistory(dataclass)
      expect(useHistoryStore.getState().getHistory(dataclass)).toHaveLength(0)
    })
  })
})
