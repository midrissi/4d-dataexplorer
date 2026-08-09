import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_INCLUDE_DOCS,
  DEFAULT_TOOLKIT_CATEGORIES,
  DEFAULT_TOOLKIT_EMOJI,
  DEFAULT_TOOLKIT_NAME,
  emojiCategoryKeys,
  patchCustomEmojis,
  type RestExportType,
  type ToolkitCategoryFlags,
  type ToolkitEmojiConfig,
  type ToolkitEmojiKey,
} from '~/lib/rest-export'

const PREFS_VERSION = 3

export type RestExportBuilderPersistedState = {
  prefsVersion: number
  name: string
  description: string
  selectedDataClasses: string[] | null
  selectedSingletons: string[] | null
  categories: ToolkitCategoryFlags
  exportType: RestExportType
  includeAccessKeyLogin: boolean
  includeDocs: boolean
  emoji: ToolkitEmojiConfig
}

type RestExportBuilderState = RestExportBuilderPersistedState & {
  setName: (name: string) => void
  setDescription: (description: string) => void
  setSelectedDataClasses: (names: string[] | null) => void
  setSelectedSingletons: (names: string[] | null) => void
  setCategory: (key: keyof ToolkitCategoryFlags, value: boolean) => void
  patchCategories: (patch: Partial<ToolkitCategoryFlags>) => void
  setExportType: (exportType: RestExportType) => void
  setIncludeAccessKeyLogin: (value: boolean) => void
  setIncludeDocs: (includeDocs: boolean) => void
  setEmojiEnabled: (enabled: boolean) => void
  setDataclassFolderEmoji: (dataclassFolderEmoji: boolean) => void
  setCustomEmoji: (key: ToolkitEmojiKey, emoji: string, options?: { category?: boolean }) => void
}

export const useRestExportBuilderStore = create<RestExportBuilderState>()(
  persist(
    (set) => ({
      prefsVersion: PREFS_VERSION,
      name: DEFAULT_TOOLKIT_NAME,
      description: '',
      selectedDataClasses: null,
      selectedSingletons: null,
      categories: { ...DEFAULT_TOOLKIT_CATEGORIES },
      exportType: 'postman',
      includeAccessKeyLogin: true,
      includeDocs: DEFAULT_INCLUDE_DOCS,
      emoji: { ...DEFAULT_TOOLKIT_EMOJI, custom: {} },
      setName: (name) => set({ name }),
      setDescription: (description) => set({ description }),
      setSelectedDataClasses: (selectedDataClasses) => set({ selectedDataClasses }),
      setSelectedSingletons: (selectedSingletons) => set({ selectedSingletons }),
      setCategory: (key, value) =>
        set((state) => ({ categories: { ...state.categories, [key]: value } })),
      patchCategories: (patch) =>
        set((state) => ({ categories: { ...state.categories, ...patch } })),
      setExportType: (exportType) => set({ exportType }),
      setIncludeAccessKeyLogin: (includeAccessKeyLogin) => set({ includeAccessKeyLogin }),
      setIncludeDocs: (includeDocs) => set({ includeDocs }),
      setEmojiEnabled: (enabled) => set((state) => ({ emoji: { ...state.emoji, enabled } })),
      setDataclassFolderEmoji: (dataclassFolderEmoji) =>
        set((state) => ({ emoji: { ...state.emoji, dataclassFolderEmoji } })),
      setCustomEmoji: (key, emoji, options) =>
        set((state) => {
          const keys = options?.category ? emojiCategoryKeys(key) : [key]
          const dataclassFolderEmoji = keys.includes('folder.dataclass')
            ? emoji.trim().length > 0
            : state.emoji.dataclassFolderEmoji
          return {
            emoji: {
              ...state.emoji,
              dataclassFolderEmoji,
              custom: patchCustomEmojis(state.emoji.custom, keys, emoji, {
                enabled: state.emoji.enabled,
                dataclassFolderEmoji,
              }),
            },
          }
        }),
    }),
    {
      name: 'dataexplorer-rest-export-toolkit-v1',
      partialize: (state) => ({
        prefsVersion: state.prefsVersion,
        name: state.name,
        description: state.description,
        selectedDataClasses: state.selectedDataClasses,
        selectedSingletons: state.selectedSingletons,
        categories: state.categories,
        exportType: state.exportType,
        includeAccessKeyLogin: state.includeAccessKeyLogin,
        includeDocs: state.includeDocs,
        emoji: state.emoji,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<RestExportBuilderPersistedState> | undefined
        const categories = { ...DEFAULT_TOOLKIT_CATEGORIES, ...saved?.categories }
        if ((saved?.prefsVersion ?? 1) < 2) {
          categories.directoryLogin = false
          categories.includeNonExposed = false
        }
        const emoji = {
          ...DEFAULT_TOOLKIT_EMOJI,
          ...saved?.emoji,
          custom: { ...DEFAULT_TOOLKIT_EMOJI.custom, ...saved?.emoji?.custom },
        }
        if ((saved?.prefsVersion ?? 1) < 3) {
          emoji.dataclassFolderEmoji = false
          delete emoji.custom['folder.dataclass']
        }
        return {
          ...current,
          ...saved,
          prefsVersion: PREFS_VERSION,
          categories,
          includeDocs: saved?.includeDocs ?? DEFAULT_INCLUDE_DOCS,
          emoji,
        }
      },
    }
  )
)
