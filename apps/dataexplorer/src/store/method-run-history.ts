import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MethodExecutorSeed } from './method-executor-types'
import { sameMethodConfig } from './same-method-config'

export type MethodResultKind = 'entity' | 'entitysel' | 'other'

export type MethodRunHistoryItem = {
  id: string
  timestamp: number
  config: MethodExecutorSeed
  resultKind: MethodResultKind
}

type MethodRunHistoryState = {
  runs: MethodRunHistoryItem[]
  addRun: (config: MethodExecutorSeed, resultKind: MethodResultKind) => void
  removeRun: (id: string) => void
  clearRuns: () => void
}

const MAX_RUNS = 30

export const useMethodRunHistoryStore = create<MethodRunHistoryState>()(
  persist(
    (set) => ({
      runs: [],
      addRun: (config, resultKind) =>
        set((state) => {
          const withoutDuplicate = state.runs.filter((run) => !sameMethodConfig(run.config, config))
          return {
            runs: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                timestamp: Date.now(),
                config,
                resultKind,
              },
              ...withoutDuplicate,
            ].slice(0, MAX_RUNS),
          }
        }),
      removeRun: (id) => set((state) => ({ runs: state.runs.filter((run) => run.id !== id) })),
      clearRuns: () => set({ runs: [] }),
    }),
    { name: 'dataexplorer-method-run-history-v1' }
  )
)
