import type { AssistantConfig, AssistantMessage } from '@4djs/assistant'
import { Database, Search, Sparkles } from 'lucide-react'
import { getAssistantLabelOverrides } from '~/i18n/assistant-ui'
import type { Locale } from '~/i18n/labels'
import { createDataExplorerLlmSettingsWithMetadata } from '~/lib/assistant-llm-metadata'
import { createDataExplorerMentionsConfig } from './mentions'
import { fetchDataExplorerSuggestedPrompts } from './suggested-prompts'
import { dataExplorerToolRegistry } from './tool-registry'

type TFunction = (key: string, params?: Record<string, string | number>) => string

const CHAT_HISTORY_STORAGE_KEY = 'dataexplorer-chat-history'

function createWelcomeMessage(
  t: TFunction,
  llmEnabled: boolean,
  model: string | null
): AssistantMessage {
  const content = llmEnabled
    ? t('assistant.welcomeConnected', { model: model ?? 'LLM' })
    : t('assistant.welcomeDisconnected')

  return {
    id: 'welcome',
    role: 'assistant',
    content,
    timestamp: Date.now(),
  }
}

export function createDataExplorerAssistantConfig(locale: Locale, t: TFunction): AssistantConfig {
  const labelOverrides = getAssistantLabelOverrides(locale)

  return {
    llm: createDataExplorerLlmSettingsWithMetadata,
    storageKeys: {
      history: CHAT_HISTORY_STORAGE_KEY,
      llmSettings: 'dataexplorer-llm-settings',
    },
    welcomeMessage: ({ llmEnabled, model }) => createWelcomeMessage(t, llmEnabled, model),
    toolRegistry: dataExplorerToolRegistry,
    mentions: createDataExplorerMentionsConfig(),
    fetchSuggestedPrompts: async ({ model, tools }) =>
      fetchDataExplorerSuggestedPrompts({ model, tools }),
    labels: {
      ...labelOverrides,
      'header.title': t('assistant.headerTitle'),
    },
    header: {
      title: t('assistant.headerTitle'),
      subtitle: t('assistant.headerSubtitle'),
      icon: Sparkles,
      showClearButton: true,
    },
    emptyState: {
      title: t('assistant.emptyStateTitle'),
      description: t('assistant.emptyStateDescription'),
      dynamicSuggestedPrompts: true,
      suggestedPrompts: [
        {
          id: 'catalog',
          icon: Database,
          label: t('assistant.promptCatalogLabel'),
          hint: t('assistant.promptCatalogHint'),
          prompt: t('assistant.promptCatalogPrompt'),
        },
        {
          id: 'query',
          icon: Search,
          label: t('assistant.promptQueryLabel'),
          hint: t('assistant.promptQueryHint'),
          prompt: t('assistant.promptQueryPrompt'),
        },
        {
          id: 'explore',
          icon: Sparkles,
          label: t('assistant.promptExploreLabel'),
          hint: t('assistant.promptExploreHint'),
          prompt: t('assistant.promptExplorePrompt'),
        },
      ],
    },
    ui: {
      showModelSelector: true,
      showUsageStats: true,
      maxWidth: '100%',
      className: 'dataexplorer-assistant assistant-chatbot-panel',
    },
  }
}
