import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { getSettingsConfigurationSnapshot } from '~/assistant/config-state'
import {
  ASSISTANT_TOOLS_META_TOOL,
  getAssistantToolPrefsSummary,
  parseToolPattern,
} from '~/assistant/tool-catalog'
import { useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'

export function buildSettingsTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@settings/state',
        description:
          'Return current app configuration: active profile, theme, language, view defaults, readonly mode, code editor prefs, dataclass customizations, and assistant tool preferences.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => toolResultOk(getSettingsConfigurationSnapshot()),
    },
    {
      definition: {
        name: '@settings/open',
        description: 'Open the settings tab.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => {
        useTabsStore.getState().openSettingsTab()
        return toolResultOk({ opened: true })
      },
    },
    {
      definition: {
        name: '@settings/update',
        description:
          'Update a settings preference by key: defaultViewMode, defaultEntityViewMode, defaultEditMode, sidebarViewMode, pageSize, language.',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: {},
          },
          required: ['key', 'value'],
        },
      },
      invoke: async (args) => {
        const key = String(args.key ?? '')
        const store = useSettingsStore.getState()
        switch (key) {
          case 'defaultViewMode':
            if (args.value !== 'cards' && args.value !== 'table') {
              return toolResultErr('value must be cards or table')
            }
            store.setDefaultViewMode(args.value)
            break
          case 'defaultEntityViewMode':
            if (args.value !== 'tree' && args.value !== 'form' && args.value !== 'json') {
              return toolResultErr('value must be tree, form, or json')
            }
            store.setDefaultEntityViewMode(args.value)
            break
          case 'defaultEditMode':
            if (args.value !== 'form' && args.value !== 'json') {
              return toolResultErr('value must be form or json')
            }
            store.setDefaultEditMode(args.value)
            break
          case 'sidebarViewMode':
            if (args.value !== 'cards' && args.value !== 'tables' && args.value !== 'icons') {
              return toolResultErr('value must be cards, tables, or icons')
            }
            store.setSidebarViewMode(args.value)
            break
          case 'pageSize':
            store.setPageSize(Number(args.value))
            break
          case 'language':
            if (args.value !== 'en' && args.value !== 'fr' && args.value !== 'es') {
              return toolResultErr('value must be en, fr, or es')
            }
            store.setLanguage(args.value)
            break
          default:
            return toolResultErr(`Unknown settings key: ${key}`)
        }
        return toolResultOk({ key, value: args.value })
      },
    },
    {
      definition: {
        name: '@settings/toggle-readonly',
        description: 'Toggle read-only mode.',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', description: 'Set explicitly instead of toggling' },
          },
        },
      },
      invoke: async (args) => {
        const store = useSettingsStore.getState()
        if (typeof args.enabled === 'boolean') {
          store.setReadonlyMode(args.enabled)
        } else {
          store.toggleReadonlyMode()
        }
        return toolResultOk({ readonlyMode: store.readonlyMode })
      },
    },
    {
      definition: {
        name: '@settings/profile',
        description:
          'Read or manage profiles. Use action "current" or "list" to answer profile questions; switch, add, rename, duplicate, remove to change profiles.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['current', 'list', 'switch', 'add', 'rename', 'duplicate', 'remove'],
            },
            profileId: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['action'],
        },
      },
      invoke: async (args) => {
        const store = useSettingsStore.getState()
        const action = String(args.action ?? '')
        switch (action) {
          case 'current': {
            const current = store.profiles.find((p) => p.id === store.currentProfileId)
            return toolResultOk({
              currentProfileId: store.currentProfileId,
              profile: current
                ? {
                    id: current.id,
                    name: current.name,
                    icon: current.icon ?? null,
                    color: current.color ?? null,
                  }
                : null,
            })
          }
          case 'list':
            return toolResultOk({
              currentProfileId: store.currentProfileId,
              profiles: store.profiles.map((p) => ({
                id: p.id,
                name: p.name,
                icon: p.icon ?? null,
                color: p.color ?? null,
                isCurrent: p.id === store.currentProfileId,
              })),
            })
          case 'switch': {
            const id = String(args.profileId ?? '')
            if (!id) return toolResultErr('profileId is required')
            store.switchProfile(id)
            return toolResultOk({ action, profileId: id })
          }
          case 'add': {
            const name = String(args.name ?? 'New profile')
            store.addProfile(name)
            return toolResultOk({ action, name })
          }
          case 'rename': {
            const id = String(args.profileId ?? '')
            const name = String(args.name ?? '')
            if (!id || !name) return toolResultErr('profileId and name are required')
            store.renameProfile(id, name)
            return toolResultOk({ action, profileId: id, name })
          }
          case 'duplicate': {
            const id = String(args.profileId ?? '')
            if (!id) return toolResultErr('profileId is required')
            store.duplicateProfile(id)
            return toolResultOk({ action, profileId: id })
          }
          case 'remove': {
            const id = String(args.profileId ?? '')
            if (!id) return toolResultErr('profileId is required')
            store.removeProfile(id)
            return toolResultOk({ action, profileId: id })
          }
          default:
            return toolResultErr(`Unknown action: ${action}`)
        }
      },
    },
    {
      definition: {
        name: '@settings/dataclass-customization',
        description:
          'Set or remove dataclass icon/color customization. icon may be a Lucide name (e.g. Users) or an emoji (e.g. 🚀). color may be a preset name (e.g. blue) or a hex value (e.g. #7D3C98).',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['set', 'remove', 'reset-all'] },
            dataclassName: { type: 'string' },
            icon: { type: 'string' },
            color: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['action'],
        },
      },
      invoke: async (args) => {
        const store = useSettingsStore.getState()
        const action = String(args.action ?? '')
        switch (action) {
          case 'set': {
            const name = String(args.dataclassName ?? args.dataClass ?? '')
            if (!name) return toolResultErr('dataclassName is required')
            const patch: {
              icon?: string
              color?: string
              description?: string
            } = {}
            if (typeof args.icon === 'string') patch.icon = args.icon
            if (typeof args.color === 'string') patch.color = args.color
            if (typeof args.description === 'string') patch.description = args.description
            if (Object.keys(patch).length === 0) {
              return toolResultErr('Provide at least one of icon, color, or description')
            }
            store.setDataclassCustomization(name, patch)
            return toolResultOk({
              action,
              dataclassName: name,
              customization: store.dataclassCustomizations[name] ?? null,
            })
          }
          case 'remove': {
            const name = String(args.dataclassName ?? '')
            if (!name) return toolResultErr('dataclassName is required')
            store.removeDataclassCustomization(name)
            return toolResultOk({ action, dataclassName: name })
          }
          case 'reset-all':
            store.resetDataclassCustomizations()
            return toolResultOk({ action })
          default:
            return toolResultErr(`Unknown action: ${action}`)
        }
      },
    },
    {
      definition: {
        name: '@settings/export',
        description: 'Export current settings or profiles as JSON string.',
        inputSchema: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['settings', 'profiles', 'profile-ids'] },
            profileIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['scope'],
        },
      },
      invoke: async (args) => {
        const store = useSettingsStore.getState()
        const scope = String(args.scope ?? '')
        switch (scope) {
          case 'settings':
            return toolResultOk({ json: store.exportSettings() })
          case 'profiles':
            return toolResultOk({ json: store.exportProfiles() })
          case 'profile-ids': {
            const ids = Array.isArray(args.profileIds) ? args.profileIds.map(String) : []
            return toolResultOk({ json: store.exportProfiles(ids) })
          }
          default:
            return toolResultErr(`Unknown scope: ${scope}`)
        }
      },
    },
    {
      definition: {
        name: '@settings/import',
        description: 'Import settings or profiles from JSON.',
        inputSchema: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['settings', 'profiles', 'profile-ids'] },
            json: { type: 'string' },
            profileIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['scope', 'json'],
        },
      },
      invoke: async (args) => {
        const store = useSettingsStore.getState()
        const scope = String(args.scope ?? '')
        const json = String(args.json ?? '')
        if (!json) return toolResultErr('json is required')
        switch (scope) {
          case 'settings': {
            const ok = store.importSettings(json)
            return ok ? toolResultOk({ imported: true }) : toolResultErr('Import failed')
          }
          case 'profiles': {
            const result = store.importProfiles(json)
            return result.ok ? toolResultOk(result) : toolResultErr('Profile import failed')
          }
          case 'profile-ids': {
            const ids = Array.isArray(args.profileIds) ? args.profileIds.map(String) : []
            const result = store.importProfilesByIds(json, ids)
            return result.ok ? toolResultOk(result) : toolResultErr('Profile import failed')
          }
          default:
            return toolResultErr(`Unknown scope: ${scope}`)
        }
      },
    },
    {
      definition: {
        name: '@settings/reset',
        description: 'Reset all settings to defaults.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => {
        useSettingsStore.getState().resetAllSettings()
        return toolResultOk({ reset: true })
      },
    },
    {
      definition: {
        name: ASSISTANT_TOOLS_META_TOOL,
        description:
          'Enable or disable assistant tools by pattern (@query/*, @datastore/delete, *). Use list to see current preferences.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'enable', 'disable'] },
            pattern: {
              type: 'string',
              description: 'Tool pattern: *, @namespace/*, or @namespace/action',
            },
          },
          required: ['action'],
        },
      },
      invoke: async (args) => {
        const action = String(args.action ?? '')
        const store = useSettingsStore.getState()

        if (action === 'list') {
          return toolResultOk(getAssistantToolPrefsSummary(store.getAssistantToolPrefs()))
        }

        const pattern = String(args.pattern ?? '')
        if (!pattern) return toolResultErr('pattern is required for enable/disable')
        if (!parseToolPattern(pattern)) return toolResultErr(`Invalid pattern: ${pattern}`)

        const enabled = action === 'enable'
        if (action !== 'enable' && action !== 'disable') {
          return toolResultErr('action must be list, enable, or disable')
        }

        store.applyAssistantToolPattern(pattern, enabled)
        return toolResultOk({
          pattern,
          enabled,
          prefs: getAssistantToolPrefsSummary(store.getAssistantToolPrefs()),
        })
      },
    },
  ]
}
