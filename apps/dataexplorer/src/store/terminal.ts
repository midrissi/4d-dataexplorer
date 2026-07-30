import { create } from 'zustand'
import type { TerminalLogLevel } from '~/lib/terminal/execute-snippet'
import type { FormattedTerminalResult } from '~/lib/terminal/result-format'

export type TerminalOutputKind = 'input' | 'log' | 'result' | 'error'

export type TerminalOutputCell = {
  id: string
  timestamp: number
  kind: TerminalOutputKind
  /** Source code for input rows */
  source?: string
  /** Console log level when kind === 'log' */
  logLevel?: TerminalLogLevel
  /** Formatted display model for result / log / error cells */
  formatted?: FormattedTerminalResult
  /** Raw error message */
  errorMessage?: string
}

export type TerminalHistoryEntry = {
  id: string
  code: string
  timestamp: number
}

const MAX_OUTPUT = 400
const MAX_HISTORY = 100

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type TerminalState = {
  output: TerminalOutputCell[]
  history: TerminalHistoryEntry[]
  historyIndex: number | null
  draft: string
  running: boolean
  appendOutput: (
    cell: Omit<TerminalOutputCell, 'id' | 'timestamp'> &
      Partial<Pick<TerminalOutputCell, 'id' | 'timestamp'>>
  ) => void
  clearOutput: () => void
  setDraft: (draft: string) => void
  setRunning: (running: boolean) => void
  pushHistory: (code: string) => void
  /** Move history cursor; returns code to show or null if at draft. */
  historyUp: (currentDraft: string) => string | null
  historyDown: () => string | null
  resetHistoryCursor: () => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  output: [],
  history: [],
  historyIndex: null,
  draft: '',
  running: false,

  appendOutput: (cell) =>
    set((state) => ({
      output: [
        ...state.output,
        {
          ...cell,
          id: cell.id ?? createId(),
          timestamp: cell.timestamp ?? Date.now(),
        },
      ].slice(-MAX_OUTPUT),
    })),

  clearOutput: () => set({ output: [] }),

  setDraft: (draft) => set({ draft }),

  setRunning: (running) => set({ running }),

  pushHistory: (code) => {
    const trimmed = code.trim()
    if (!trimmed) return
    set((state) => {
      const withoutDup = state.history.filter((entry) => entry.code !== trimmed)
      return {
        history: [...withoutDup, { id: createId(), code: trimmed, timestamp: Date.now() }].slice(
          -MAX_HISTORY
        ),
        historyIndex: null,
      }
    })
  },

  historyUp: (currentDraft) => {
    const { history, historyIndex } = get()
    if (history.length === 0) return null
    if (historyIndex === null) {
      // Stash current draft at end of navigation by storing index at last item
      const nextIndex = history.length - 1
      set({ historyIndex: nextIndex, draft: currentDraft })
      return history[nextIndex]?.code ?? null
    }
    if (historyIndex <= 0) {
      return history[0]?.code ?? null
    }
    const nextIndex = historyIndex - 1
    set({ historyIndex: nextIndex })
    return history[nextIndex]?.code ?? null
  },

  historyDown: () => {
    const { history, historyIndex, draft } = get()
    if (historyIndex === null) return null
    if (historyIndex >= history.length - 1) {
      set({ historyIndex: null })
      return draft
    }
    const nextIndex = historyIndex + 1
    set({ historyIndex: nextIndex })
    return history[nextIndex]?.code ?? null
  },

  resetHistoryCursor: () => set({ historyIndex: null }),
}))
