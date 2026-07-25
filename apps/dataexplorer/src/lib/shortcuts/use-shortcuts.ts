import { useCallback, useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getDefaultPreset, getPreset, presets } from './presets'
import type { KeyCombination, ShortcutAction, ShortcutConfig, ShortcutDefinition } from './types'
import { isInputElement, matchesKeyCombination } from './utils'

/**
 * Shortcut store state
 */
interface ShortcutState {
  config: ShortcutConfig
  handlers: Map<ShortcutAction, () => void>
  setPreset: (presetId: string) => void
  setCustomShortcut: (action: ShortcutAction, keys: KeyCombination) => void
  resetCustomShortcuts: () => void
  registerHandler: (action: ShortcutAction, handler: () => void) => void
  unregisterHandler: (action: ShortcutAction) => void
}

/**
 * Zustand store for shortcuts
 */
export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      config: {
        activePreset: getDefaultPreset().id,
        customOverrides: {},
      },
      handlers: new Map(),

      setPreset: (presetId: string) => {
        const preset = getPreset(presetId)
        if (preset) {
          set((state) => ({
            config: { ...state.config, activePreset: presetId },
          }))
        }
      },

      setCustomShortcut: (action: ShortcutAction, keys: KeyCombination) => {
        set((state) => ({
          config: {
            ...state.config,
            customOverrides: {
              ...state.config.customOverrides,
              [action]: keys,
            },
          },
        }))
      },

      resetCustomShortcuts: () => {
        set((state) => ({
          config: { ...state.config, customOverrides: {} },
        }))
      },

      registerHandler: (action: ShortcutAction, handler: () => void) => {
        const handlers = new Map(get().handlers)
        handlers.set(action, handler)
        set({ handlers })
      },

      unregisterHandler: (action: ShortcutAction) => {
        const handlers = new Map(get().handlers)
        handlers.delete(action)
        set({ handlers })
      },
    }),
    {
      name: 'shortcut-config',
      partialize: (state) => ({ config: state.config }),
    }
  )
)

/**
 * Get the effective shortcuts (preset + overrides)
 */
export function useEffectiveShortcuts(): ShortcutDefinition[] {
  const { config } = useShortcutStore()

  return useMemo(() => {
    const preset = getPreset(config.activePreset) ?? getDefaultPreset()

    return preset.shortcuts.map((shortcut) => {
      const override = config.customOverrides[shortcut.action]
      if (override) {
        return { ...shortcut, keys: override }
      }
      return shortcut
    })
  }, [config])
}

/**
 * Hook to register a shortcut handler
 */
export function useShortcut(action: ShortcutAction, handler: () => void): void {
  const { registerHandler, unregisterHandler } = useShortcutStore()

  // Keep the latest handler in a ref so the registered callback stays stable
  // without relying on a caller-provided dependency array.
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  const memoizedHandler = useCallback(() => handlerRef.current(), [])

  useEffect(() => {
    registerHandler(action, memoizedHandler)
    return () => unregisterHandler(action)
  }, [action, memoizedHandler, registerHandler, unregisterHandler])
}

/**
 * Hook to set up the global keyboard listener
 */
export function useShortcutListener(): void {
  const { handlers } = useShortcutStore()
  const shortcuts = useEffectiveShortcuts()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Find matching shortcut
      for (const shortcut of shortcuts) {
        if (matchesKeyCombination(event, shortcut.keys)) {
          // Check if we should handle this in input elements
          if (!shortcut.allowInInput && isInputElement(event.target)) {
            continue
          }

          // Get and execute handler
          const handler = handlers.get(shortcut.action)
          if (handler) {
            event.preventDefault()
            event.stopPropagation()
            handler()
            return
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, handlers])
}

/**
 * Get all available presets
 */
export function usePresets() {
  return presets
}

/**
 * Get the current preset
 */
export function useCurrentPreset() {
  const { config } = useShortcutStore()
  return getPreset(config.activePreset) ?? getDefaultPreset()
}
