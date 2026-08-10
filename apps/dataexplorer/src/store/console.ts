import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ConsoleLogLevel = 'log' | 'info' | 'warn' | 'error' | 'network'
export type ConsoleFilter = 'all' | ConsoleLogLevel

export type NetworkDetails = {
  method: string
  url: string
  status?: number
  statusText?: string
  durationMs: number
  responseSizeBytes?: number
  requestHeaders: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: unknown
  responseBody?: unknown
  error?: unknown
}

export type ConsoleEntry = {
  id: string
  timestamp: number
  level: ConsoleLogLevel
  message: unknown
  args?: unknown[]
  network?: NetworkDetails
}

type NewConsoleEntry = Omit<ConsoleEntry, 'id' | 'timestamp'> &
  Partial<Pick<ConsoleEntry, 'id' | 'timestamp'>>

type ConsoleState = {
  entries: ConsoleEntry[]
  filter: ConsoleFilter
  /** When true, network row paths show percent-decoded query strings. */
  showDecodedUrls: boolean
  append: (entry: NewConsoleEntry) => void
  clear: () => void
  setFilter: (filter: ConsoleFilter) => void
  setShowDecodedUrls: (showDecodedUrls: boolean) => void
}

export const MAX_CONSOLE_ENTRIES = 500

function createEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set) => ({
      entries: [],
      filter: 'all',
      showDecodedUrls: false,
      append: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            {
              ...entry,
              id: entry.id ?? createEntryId(),
              timestamp: entry.timestamp ?? Date.now(),
            },
          ].slice(-MAX_CONSOLE_ENTRIES),
        })),
      clear: () => set({ entries: [] }),
      setFilter: (filter) => set({ filter }),
      setShowDecodedUrls: (showDecodedUrls) => set({ showDecodedUrls }),
    }),
    {
      name: 'dataexplorer-console-prefs',
      partialize: (state) => ({
        showDecodedUrls: state.showDecodedUrls,
      }),
    }
  )
)
