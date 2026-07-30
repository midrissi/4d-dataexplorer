import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SnippetPackItem } from '~/lib/terminal/snippet-pack'

export type TerminalSnippet = {
  id: string
  name: string
  code: string
  createdAt: number
  updatedAt: number
}

export type ImportSnippetsResult = {
  added: number
  skipped: number
  failed: number
}

type TerminalSnippetsState = {
  snippets: TerminalSnippet[]
  addSnippet: (input: { name: string; code: string }) => TerminalSnippet | null
  updateSnippet: (id: string, input: { name: string; code: string }) => boolean
  removeSnippet: (id: string) => boolean
  getByName: (name: string) => TerminalSnippet | undefined
  clearSnippets: () => void
  /** Merge pack items; skips invalid names and existing names. */
  importSnippets: (items: SnippetPackItem[]) => ImportSnippetsResult
}

export const MAX_TERMINAL_SNIPPETS = 50
const NAME_RE = /^[A-Za-z_][\w-]{0,47}$/

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizeSnippetName(name: string): string {
  return name.trim()
}

export function isValidSnippetName(name: string): boolean {
  return NAME_RE.test(normalizeSnippetName(name))
}

export const useTerminalSnippetsStore = create<TerminalSnippetsState>()(
  persist(
    (set, get) => ({
      snippets: [],

      addSnippet: ({ name, code }) => {
        const normalized = normalizeSnippetName(name)
        const trimmedCode = code.trim()
        if (!isValidSnippetName(normalized) || !trimmedCode) return null
        if (get().getByName(normalized)) return null
        if (get().snippets.length >= MAX_TERMINAL_SNIPPETS) return null

        const now = Date.now()
        const snippet: TerminalSnippet = {
          id: createId(),
          name: normalized,
          code: trimmedCode,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ snippets: [...state.snippets, snippet] }))
        return snippet
      },

      updateSnippet: (id, { name, code }) => {
        const normalized = normalizeSnippetName(name)
        const trimmedCode = code.trim()
        if (!isValidSnippetName(normalized) || !trimmedCode) return false
        const existing = get().snippets.find((s) => s.id === id)
        if (!existing) return false
        const clash = get().snippets.find(
          (s) => s.id !== id && s.name.toLowerCase() === normalized.toLowerCase()
        )
        if (clash) return false
        set((state) => ({
          snippets: state.snippets.map((s) =>
            s.id === id ? { ...s, name: normalized, code: trimmedCode, updatedAt: Date.now() } : s
          ),
        }))
        return true
      },

      removeSnippet: (id) => {
        const before = get().snippets.length
        set((state) => ({ snippets: state.snippets.filter((s) => s.id !== id) }))
        return get().snippets.length < before
      },

      getByName: (name) => {
        const normalized = normalizeSnippetName(name).toLowerCase()
        return get().snippets.find((s) => s.name.toLowerCase() === normalized)
      },

      clearSnippets: () => set({ snippets: [] }),

      importSnippets: (items) => {
        let added = 0
        let skipped = 0
        let failed = 0
        for (const item of items) {
          if (get().snippets.length >= MAX_TERMINAL_SNIPPETS) {
            failed += items.length - (added + skipped + failed)
            break
          }
          const normalized = normalizeSnippetName(item.name)
          const trimmedCode = item.code.trim()
          if (!isValidSnippetName(normalized) || !trimmedCode) {
            failed += 1
            continue
          }
          if (get().getByName(normalized)) {
            skipped += 1
            continue
          }
          const created = get().addSnippet({ name: normalized, code: trimmedCode })
          if (created) added += 1
          else failed += 1
        }
        return { added, skipped, failed }
      },
    }),
    { name: 'dataexplorer-terminal-snippets-v1' }
  )
)
