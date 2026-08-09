import { DEFAULT_TOOLKIT_EMOJI, type ToolkitEmojiConfig } from './toolkit-emoji'
import type { ToolkitCategoryFlags, ToolkitConfig, ToolkitVariables } from './toolkit-types'

export const DEFAULT_TOOLKIT_CATEGORIES: ToolkitCategoryFlags = {
  auth: true,
  catalog: true,
  info: true,
  datastoreFunctions: true,
  singletons: true,
  crudList: true,
  crudCreate: true,
  crudGet: true,
  crudUpdate: true,
  crudDeleteByKey: true,
  entitySetCreate: true,
  entitySetPage: true,
  entitySetClean: true,
  entitySetRelease: true,
  functions: true,
  deleteAll: false,
  deleteByFilter: false,
  deleteEntitySet: false,
  compute: false,
  directoryLogin: false,
  httpGetVariants: false,
  includeNonExposed: false,
}

export const DEFAULT_TOOLKIT_VARIABLES: ToolkitVariables = {
  baseUrl: '',
  accessKey: '',
  username: '',
  password: '',
  includeAccessKeyLogin: false,
}

export const DEFAULT_TOOLKIT_NAME = '4D REST API'

export const DEFAULT_INCLUDE_DOCS = true

export function createDefaultToolkitConfig(
  overrides?: Partial<Omit<ToolkitConfig, 'categories' | 'variables' | 'emoji'>> & {
    categories?: Partial<ToolkitCategoryFlags>
    variables?: Partial<ToolkitVariables>
    emoji?: Partial<ToolkitEmojiConfig>
  }
): ToolkitConfig {
  return {
    name: overrides?.name ?? DEFAULT_TOOLKIT_NAME,
    description: overrides?.description ?? '',
    selectedDataClasses: overrides?.selectedDataClasses ?? [],
    selectedSingletons: overrides?.selectedSingletons ?? [],
    exportType: overrides?.exportType ?? 'postman',
    includeDocs: overrides?.includeDocs ?? DEFAULT_INCLUDE_DOCS,
    categories: { ...DEFAULT_TOOLKIT_CATEGORIES, ...overrides?.categories },
    variables: { ...DEFAULT_TOOLKIT_VARIABLES, ...overrides?.variables },
    emoji: {
      ...DEFAULT_TOOLKIT_EMOJI,
      ...overrides?.emoji,
      custom: { ...DEFAULT_TOOLKIT_EMOJI.custom, ...overrides?.emoji?.custom },
    },
  }
}
