import type { ThemeName } from '@4d/ui'
import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { getTheme, setTheme, setThemeName } from '~/lib/storage'
import { type Language, useSettingsStore } from '~/store/settings'

export function buildAppearanceTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@appearance/language',
        description: 'Set the UI language.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['en', 'fr', 'es'] },
          },
          required: ['language'],
        },
      },
      invoke: async (args) => {
        const language = String(args.language ?? '') as Language
        if (!['en', 'fr', 'es'].includes(language)) {
          return toolResultErr('language must be en, fr, or es')
        }
        useSettingsStore.getState().setLanguage(language)
        return toolResultOk({ language })
      },
    },
    {
      definition: {
        name: '@appearance/theme',
        description: 'Set light or dark mode.',
        inputSchema: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark'] },
          },
          required: ['theme'],
        },
      },
      invoke: async (args) => {
        const theme = args.theme === 'dark' ? 'dark' : 'light'
        setTheme(theme)
        return toolResultOk({ theme })
      },
    },
    {
      definition: {
        name: '@appearance/color-theme',
        description:
          'Set the color theme name (slate, tangerine, violet-bloom, graphite, aurora, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            themeName: { type: 'string' },
          },
          required: ['themeName'],
        },
      },
      invoke: async (args) => {
        const themeName = String(args.themeName ?? '') as ThemeName
        if (!themeName) return toolResultErr('themeName is required')
        setThemeName(themeName)
        return toolResultOk({ themeName })
      },
    },
    {
      definition: {
        name: '@appearance/toggle-theme',
        description: 'Toggle between light and dark mode.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => {
        const current = getTheme()
        const next = current === 'dark' ? 'light' : 'dark'
        setTheme(next)
        return toolResultOk({ theme: next })
      },
    },
    {
      definition: {
        name: '@appearance/toggle-sidebar',
        description: 'Collapse or expand the sidebar.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => {
        useSettingsStore.getState().toggleSidebarCollapsed()
        return toolResultOk({
          sidebarCollapsed: useSettingsStore.getState().sidebarCollapsed,
        })
      },
    },
  ]
}
