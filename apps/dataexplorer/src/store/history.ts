import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QueryOptions } from './tabs'

export type HistoryItem = {
  id: string
  query: QueryOptions
  timestamp: number
  resultsCount?: number
}

type HistoryState = {
  // History per dataclass: { dataclassName: HistoryItem[] }
  history: Record<string, HistoryItem[]>

  // Actions
  addToHistory: (dataclass: string, query: QueryOptions, resultsCount?: number) => void
  removeFromHistory: (dataclass: string, itemId: string) => void
  clearHistory: (dataclass: string) => void
  getHistory: (dataclass: string) => HistoryItem[]
}

const MAX_HISTORY_PER_DATACLASS = 20

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: {},

      addToHistory: (dataclass, query, resultsCount) => {
        const currentHistory = get().history[dataclass] || []

        // Don't add if it's the same as the last query
        if (currentHistory.length > 0) {
          const lastItem = currentHistory[0]
          if (
            lastItem &&
            lastItem.query.filter === query.filter &&
            lastItem.query.sort === query.sort &&
            lastItem.query.order === query.order &&
            lastItem.query.select === query.select &&
            lastItem.query.top === query.top
          ) {
            return
          }
        }

        // Don't add empty/default queries
        if (!query.filter && query.sort === '__KEY' && query.order === 'desc' && !query.select) {
          return
        }

        const newItem: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          query,
          timestamp: Date.now(),
          resultsCount,
        }

        const newHistory = [newItem, ...currentHistory].slice(0, MAX_HISTORY_PER_DATACLASS)

        set({
          history: {
            ...get().history,
            [dataclass]: newHistory,
          },
        })
      },

      removeFromHistory: (dataclass, itemId) => {
        const currentHistory = get().history[dataclass] || []
        const newHistory = currentHistory.filter((item) => item.id !== itemId)

        set({
          history: {
            ...get().history,
            [dataclass]: newHistory,
          },
        })
      },

      clearHistory: (dataclass) => {
        const newHistory = { ...get().history }
        delete newHistory[dataclass]

        set({ history: newHistory })
      },

      getHistory: (dataclass) => {
        return get().history[dataclass] || []
      },
    }),
    {
      name: 'dataexplorer-query-history',
    }
  )
)
