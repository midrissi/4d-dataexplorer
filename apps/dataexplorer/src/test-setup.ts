/**
 * Test setup: define window, localStorage, and StorageEvent so app modules load in Bun (no DOM).
 */
import './test-rest-mock'

// React 18+ requires this flag when calling act() outside Testing Library / Jest.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const store = new Map<string, string>()
const testStorage: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  get length() {
    return store.size
  },
  key: (i: number) => [...store.keys()][i] ?? null,
}

if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as { localStorage: Storage }).localStorage = testStorage
}

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    ...(typeof globalThis.navigator === 'object' && globalThis.navigator
      ? globalThis.navigator
      : {}),
    onLine: true,
  },
})

if (typeof globalThis.window === 'undefined') {
  const listeners = new Map<string, Set<(e: Event) => void>>()
  ;(
    globalThis as {
      window: {
        location: { origin: string }
        dispatchEvent: (e: Event) => boolean
        localStorage: Storage
        addEventListener: (type: string, fn: (e: Event) => void) => void
        removeEventListener: (type: string, fn: (e: Event) => void) => void
      }
    }
  ).window = {
    location: { origin: 'http://localhost:3002' },
    dispatchEvent: (e: Event) => {
      const set = listeners.get(e.type)
      if (set) for (const fn of set) fn(e)
      return true
    },
    localStorage: testStorage,
    addEventListener: (type: string, fn: (e: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(fn)
    },
    removeEventListener: (type: string, fn: (e: Event) => void) => {
      listeners.get(type)?.delete(fn)
    },
  }
}

if (typeof globalThis.StorageEvent === 'undefined') {
  class TestStorageEvent extends Event {
    key: string | null = null
    oldValue: string | null = null
    newValue: string | null = null
    url = ''
    storageArea: Storage | null = null
    constructor(type: string, init?: Partial<StorageEventInit>) {
      super(type, init)
      if (init) {
        this.key = init.key ?? null
        this.oldValue = init.oldValue ?? null
        this.newValue = init.newValue ?? null
        this.url = init.url ?? ''
        this.storageArea = init.storageArea ?? null
      }
    }
    initStorageEvent(): void {
      // no-op for test polyfill
    }
  }
  ;(globalThis as unknown as { StorageEvent: typeof TestStorageEvent }).StorageEvent =
    TestStorageEvent
}
