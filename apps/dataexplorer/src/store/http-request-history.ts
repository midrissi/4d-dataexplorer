import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HttpClientSeed } from './http-client-types'

export const HTTP_REQUEST_HISTORY_LIMIT_OPTIONS = [10, 20, 30, 50, 100] as const
export const DEFAULT_HTTP_REQUEST_HISTORY_LIMIT = 30

export type HttpRequestHistoryItem = {
  id: string
  timestamp: number
  seed: HttpClientSeed
  status?: number
  statusText?: string
  durationMs?: number
  error?: string
}

type HttpRequestHistoryState = {
  requests: HttpRequestHistoryItem[]
  maxCount: number
  addRequest: (
    seed: HttpClientSeed,
    meta?: Pick<HttpRequestHistoryItem, 'status' | 'statusText' | 'durationMs' | 'error'>
  ) => void
  removeRequest: (id: string) => void
  clearRequests: () => void
  setMaxCount: (count: number) => void
}

function sameSeed(left: HttpClientSeed, right: HttpClientSeed): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clampMaxCount(count: number): number {
  const options = HTTP_REQUEST_HISTORY_LIMIT_OPTIONS
  if ((options as readonly number[]).includes(count)) return count
  // Snap to nearest allowed option
  let best: number = options[0]
  let bestDist = Math.abs(count - best)
  for (const option of options) {
    const dist = Math.abs(count - option)
    if (dist < bestDist) {
      best = option
      bestDist = dist
    }
  }
  return best
}

export const useHttpRequestHistoryStore = create<HttpRequestHistoryState>()(
  persist(
    (set) => ({
      requests: [],
      maxCount: DEFAULT_HTTP_REQUEST_HISTORY_LIMIT,
      addRequest: (seed, meta) =>
        set((state) => {
          const withoutDuplicate = state.requests.filter((item) => !sameSeed(item.seed, seed))
          return {
            requests: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                timestamp: Date.now(),
                seed,
                status: meta?.status,
                statusText: meta?.statusText,
                durationMs: meta?.durationMs,
                error: meta?.error,
              },
              ...withoutDuplicate,
            ].slice(0, state.maxCount),
          }
        }),
      removeRequest: (id) =>
        set((state) => ({ requests: state.requests.filter((item) => item.id !== id) })),
      clearRequests: () => set({ requests: [] }),
      setMaxCount: (count) =>
        set((state) => {
          const maxCount = clampMaxCount(count)
          return {
            maxCount,
            requests: state.requests.slice(0, maxCount),
          }
        }),
    }),
    { name: 'dataexplorer-http-request-history-v1' }
  )
)
