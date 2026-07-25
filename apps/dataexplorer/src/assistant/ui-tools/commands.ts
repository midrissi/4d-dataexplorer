import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { createCommandContext } from '~/lib/command-context'
import {
  buildCommands,
  type CommandCategory,
  getCommandById,
  getCommandsByCategory,
  getEnabledCommands,
} from '~/lib/commands'
import { type CommandPaletteMode, eventBus } from '~/lib/eventBus'

export function buildCommandTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@commands/list',
        description:
          'List available command-palette commands. Optionally filter by category (Help, Appearance, View, Navigation, Dataclasses, Entities, Entity, Tabs, Settings).',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'Help',
                'Appearance',
                'View',
                'Navigation',
                'Dataclasses',
                'Entities',
                'Entity',
                'Tabs',
                'Settings',
              ],
            },
          },
        },
      },
      invoke: async (args) => {
        const ctx = createCommandContext()
        const commands = getEnabledCommands(buildCommands(ctx))
        const category = args.category as CommandCategory | undefined
        const filtered = category ? getCommandsByCategory(commands, category) : commands
        return toolResultOk({
          commands: filtered.map((c) => ({
            id: c.id,
            label: c.label,
            description: c.description,
            category: c.category,
            disabled: c.disabled ?? false,
          })),
        })
      },
    },
    {
      definition: {
        name: '@commands/execute',
        description:
          'Execute a command-palette command by id (e.g. open-home, open-dataclass-Customers, toggle-theme).',
        inputSchema: {
          type: 'object',
          properties: {
            commandId: { type: 'string', description: 'Command id from @commands/list' },
          },
          required: ['commandId'],
        },
      },
      invoke: async (args) => {
        const commandId = String(args.commandId ?? '')
        if (!commandId) return toolResultErr('commandId is required')
        const ctx = createCommandContext()
        const command = getCommandById(buildCommands(ctx), commandId)
        if (!command) return toolResultErr(`Unknown command: ${commandId}`)
        if (command.disabled) return toolResultErr(`Command is currently disabled: ${commandId}`)
        command.action()
        return toolResultOk({ executed: commandId, label: command.label })
      },
    },
    {
      definition: {
        name: '@commands/open',
        description: 'Open the command palette, optionally in a specific mode.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['default', 'go-to', 'dataclass-select', 'dataclass-data', 'switch-tabs'],
            },
          },
        },
      },
      invoke: async (args) => {
        const mode = args.mode as CommandPaletteMode | undefined
        eventBus.emit('open-command-palette', mode ? { mode } : undefined)
        return toolResultOk({ opened: true, mode: mode ?? 'default' })
      },
    },
  ]
}
