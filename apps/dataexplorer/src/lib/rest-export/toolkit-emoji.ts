export const TOOLKIT_EMOJI_KEYS = [
  'folder.auth',
  'folder.catalog',
  'folder.info',
  'folder.datastoreFunctions',
  'folder.singletons',
  'folder.functions',
  'folder.dataclass',
  'folder.singleton',
  'folder.dataclassScope',
  'folder.entityScope',
  'folder.entitySelectionScope',
  'request.login',
  'request.authentify',
  'request.directoryLogin',
  'request.catalog',
  'request.catalogAll',
  'request.catalogAllMetadata',
  'request.catalogDataClass',
  'request.serverInfo',
  'request.upload',
  'request.list',
  'request.create',
  'request.getByKey',
  'request.update',
  'request.deleteByKey',
  'request.deleteByFilter',
  'request.deleteAll',
  'request.createEntitySet',
  'request.pageEntitySet',
  'request.cleanEntitySet',
  'request.releaseEntitySet',
  'request.deleteEntitySet',
  'request.compute',
  'request.datastoreFn',
  'request.classFn',
  'request.classFnGet',
  'request.classFnEntitySet',
  'request.singletonFn',
  'request.singletonFnGet',
] as const

export type ToolkitEmojiKey = (typeof TOOLKIT_EMOJI_KEYS)[number]

const EMOJI_CATEGORIES: ToolkitEmojiKey[][] = [
  [
    'folder.auth',
    'folder.catalog',
    'folder.info',
    'folder.datastoreFunctions',
    'folder.singletons',
    'folder.functions',
  ],
  ['folder.dataclass'],
  ['folder.singleton'],
  ['folder.dataclassScope', 'folder.entityScope', 'folder.entitySelectionScope'],
  ['request.login', 'request.authentify', 'request.directoryLogin'],
  [
    'request.catalog',
    'request.catalogAll',
    'request.catalogAllMetadata',
    'request.catalogDataClass',
  ],
  ['request.serverInfo', 'request.upload'],
  [
    'request.list',
    'request.create',
    'request.getByKey',
    'request.update',
    'request.deleteByKey',
    'request.deleteByFilter',
    'request.deleteAll',
  ],
  [
    'request.createEntitySet',
    'request.pageEntitySet',
    'request.cleanEntitySet',
    'request.releaseEntitySet',
    'request.deleteEntitySet',
  ],
  ['request.compute'],
  [
    'request.datastoreFn',
    'request.classFn',
    'request.classFnGet',
    'request.classFnEntitySet',
    'request.singletonFn',
    'request.singletonFnGet',
  ],
]

export function emojiCategoryKeys(key: ToolkitEmojiKey): ToolkitEmojiKey[] {
  return EMOJI_CATEGORIES.find((group) => group.includes(key)) ?? [key]
}

export type ToolkitEmojiConfig = {
  enabled: boolean
  dataclassFolderEmoji: boolean
  custom: Partial<Record<ToolkitEmojiKey, string>>
}

export const DEFAULT_TOOLKIT_EMOJI: ToolkitEmojiConfig = {
  enabled: true,
  dataclassFolderEmoji: false,
  custom: {},
}

export const PLAIN_FOLDERS = {
  auth: 'Auth',
  catalog: 'Catalog',
  info: 'Info',
  datastoreFunctions: 'Datastore functions',
  singletons: 'Singletons',
  functions: 'Functions',
  dataClassTemplate: 'DataClass',
  dataclassScope: 'dataclass',
  entityScope: 'entity',
  entitySelectionScope: 'entitySelection',
} as const

export const PLAIN_LABELS = {
  login: 'Login (access key)',
  authentify: 'Authentify',
  directoryLogin: 'Directory login',
  catalog: 'Catalog',
  catalogAll: 'Catalog ($all)',
  catalogAllMetadata: 'Catalog ($all + metadata)',
  catalogDataClass: (dataClass: string) => `Catalog — ${dataClass}`,
  serverInfo: 'Server info',
  upload: 'Upload',
  list: 'List / query',
  create: 'Create',
  getByKey: 'Get by key',
  update: 'Update',
  deleteByKey: 'Delete by key',
  deleteByFilter: 'Delete by filter',
  deleteAll: 'Delete all',
  createEntitySet: 'Create entity set',
  pageEntitySet: 'Page entity set',
  cleanEntitySet: 'Clean entity set',
  releaseEntitySet: 'Release entity set',
  deleteEntitySet: 'Delete entity set',
  compute: 'Compute',
  datastoreFn: (name: string) => name,
  classFn: (name: string) => name,
  classFnGet: (name: string) => `${name} (GET)`,
  classFnEntitySet: (name: string) => `${name} ($entityset)`,
  singletonFn: (name: string) => name,
  singletonFnGet: (name: string) => `${name} (GET)`,
} as const

export const DEFAULT_TOOLKIT_EMOJIS: Record<ToolkitEmojiKey, string> = {
  'folder.auth': '📁',
  'folder.catalog': '📁',
  'folder.info': '📁',
  'folder.datastoreFunctions': '📁',
  'folder.singletons': '📁',
  'folder.functions': '📁',
  'folder.dataclass': '📁',
  'folder.singleton': '',
  'folder.dataclassScope': '',
  'folder.entityScope': '',
  'folder.entitySelectionScope': '',
  'request.login': '🔐',
  'request.authentify': '🔑',
  'request.directoryLogin': '🔑',
  'request.catalog': '📚',
  'request.catalogAll': '📚',
  'request.catalogAllMetadata': '📚',
  'request.catalogDataClass': '📘',
  'request.serverInfo': 'ℹ️',
  'request.upload': '📤',
  'request.list': '📋',
  'request.create': '➕',
  'request.getByKey': '🔎',
  'request.update': '✏️',
  'request.deleteByKey': '🗑️',
  'request.deleteByFilter': '🗑️',
  'request.deleteAll': '⚠️',
  'request.createEntitySet': '📦',
  'request.pageEntitySet': '📦',
  'request.cleanEntitySet': '🧹',
  'request.releaseEntitySet': '🔓',
  'request.deleteEntitySet': '🗑️',
  'request.compute': '📊',
  'request.datastoreFn': '⚡',
  'request.classFn': '⚡',
  'request.classFnGet': '⚡',
  'request.classFnEntitySet': '⚡',
  'request.singletonFn': '🧩',
  'request.singletonFnGet': '🧩',
}

export function normalizeToolkitEmoji(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function emojiForKey(key: ToolkitEmojiKey, config: ToolkitEmojiConfig): string {
  if (!config.enabled) return ''
  if (key === 'folder.dataclass' && !config.dataclassFolderEmoji) return ''
  if (Object.hasOwn(config.custom, key)) {
    return normalizeToolkitEmoji(config.custom[key])
  }
  return DEFAULT_TOOLKIT_EMOJIS[key]
}

export function formatToolkitTitle(
  plain: string,
  key: ToolkitEmojiKey | undefined,
  config: ToolkitEmojiConfig
): string {
  if (!key) return plain
  const emoji = emojiForKey(key, config)
  return emoji ? `${emoji} ${plain}` : plain
}

export function patchCustomEmoji(
  custom: Partial<Record<ToolkitEmojiKey, string>>,
  key: ToolkitEmojiKey,
  emoji: string,
  config: Omit<ToolkitEmojiConfig, 'custom'>
): Partial<Record<ToolkitEmojiKey, string>> {
  const next = { ...custom }
  const normalized = normalizeToolkitEmoji(emoji)
  const fallback =
    key === 'folder.dataclass' && !config.dataclassFolderEmoji ? '' : DEFAULT_TOOLKIT_EMOJIS[key]
  if (normalized === fallback) {
    delete next[key]
    return next
  }
  next[key] = normalized
  return next
}

export function patchCustomEmojis(
  custom: Partial<Record<ToolkitEmojiKey, string>>,
  keys: readonly ToolkitEmojiKey[],
  emoji: string,
  config: Omit<ToolkitEmojiConfig, 'custom'>
): Partial<Record<ToolkitEmojiKey, string>> {
  let next = custom
  for (const key of keys) {
    next = patchCustomEmoji(next, key, emoji, config)
  }
  return next
}

export const toolkitFolders = {
  auth: formatToolkitTitle(PLAIN_FOLDERS.auth, 'folder.auth', DEFAULT_TOOLKIT_EMOJI),
  catalog: formatToolkitTitle(PLAIN_FOLDERS.catalog, 'folder.catalog', DEFAULT_TOOLKIT_EMOJI),
  info: formatToolkitTitle(PLAIN_FOLDERS.info, 'folder.info', DEFAULT_TOOLKIT_EMOJI),
  datastoreFunctions: formatToolkitTitle(
    PLAIN_FOLDERS.datastoreFunctions,
    'folder.datastoreFunctions',
    DEFAULT_TOOLKIT_EMOJI
  ),
  singletons: formatToolkitTitle(
    PLAIN_FOLDERS.singletons,
    'folder.singletons',
    DEFAULT_TOOLKIT_EMOJI
  ),
  functions: formatToolkitTitle(PLAIN_FOLDERS.functions, 'folder.functions', DEFAULT_TOOLKIT_EMOJI),
  dataClassTemplate: formatToolkitTitle(
    PLAIN_FOLDERS.dataClassTemplate,
    'folder.dataclass',
    DEFAULT_TOOLKIT_EMOJI
  ),
  dataclassScope: PLAIN_FOLDERS.dataclassScope,
  entityScope: PLAIN_FOLDERS.entityScope,
  entitySelectionScope: PLAIN_FOLDERS.entitySelectionScope,
} as const

export function dataclassFolderName(
  dataClass: string,
  config: ToolkitEmojiConfig = DEFAULT_TOOLKIT_EMOJI
): string {
  return formatToolkitTitle(dataClass, 'folder.dataclass', config)
}

export const toolkitLabels = {
  login: formatToolkitTitle(PLAIN_LABELS.login, 'request.login', DEFAULT_TOOLKIT_EMOJI),
  authentify: formatToolkitTitle(
    PLAIN_LABELS.authentify,
    'request.authentify',
    DEFAULT_TOOLKIT_EMOJI
  ),
  directoryLogin: formatToolkitTitle(
    PLAIN_LABELS.directoryLogin,
    'request.directoryLogin',
    DEFAULT_TOOLKIT_EMOJI
  ),
  catalog: formatToolkitTitle(PLAIN_LABELS.catalog, 'request.catalog', DEFAULT_TOOLKIT_EMOJI),
  catalogAll: formatToolkitTitle(
    PLAIN_LABELS.catalogAll,
    'request.catalogAll',
    DEFAULT_TOOLKIT_EMOJI
  ),
  catalogAllMetadata: formatToolkitTitle(
    PLAIN_LABELS.catalogAllMetadata,
    'request.catalogAllMetadata',
    DEFAULT_TOOLKIT_EMOJI
  ),
  catalogDataClass: (dataClass: string) =>
    formatToolkitTitle(
      PLAIN_LABELS.catalogDataClass(dataClass),
      'request.catalogDataClass',
      DEFAULT_TOOLKIT_EMOJI
    ),
  serverInfo: formatToolkitTitle(
    PLAIN_LABELS.serverInfo,
    'request.serverInfo',
    DEFAULT_TOOLKIT_EMOJI
  ),
  upload: formatToolkitTitle(PLAIN_LABELS.upload, 'request.upload', DEFAULT_TOOLKIT_EMOJI),
  list: formatToolkitTitle(PLAIN_LABELS.list, 'request.list', DEFAULT_TOOLKIT_EMOJI),
  create: formatToolkitTitle(PLAIN_LABELS.create, 'request.create', DEFAULT_TOOLKIT_EMOJI),
  getByKey: formatToolkitTitle(PLAIN_LABELS.getByKey, 'request.getByKey', DEFAULT_TOOLKIT_EMOJI),
  update: formatToolkitTitle(PLAIN_LABELS.update, 'request.update', DEFAULT_TOOLKIT_EMOJI),
  deleteByKey: formatToolkitTitle(
    PLAIN_LABELS.deleteByKey,
    'request.deleteByKey',
    DEFAULT_TOOLKIT_EMOJI
  ),
  deleteByFilter: formatToolkitTitle(
    PLAIN_LABELS.deleteByFilter,
    'request.deleteByFilter',
    DEFAULT_TOOLKIT_EMOJI
  ),
  deleteAll: formatToolkitTitle(PLAIN_LABELS.deleteAll, 'request.deleteAll', DEFAULT_TOOLKIT_EMOJI),
  createEntitySet: formatToolkitTitle(
    PLAIN_LABELS.createEntitySet,
    'request.createEntitySet',
    DEFAULT_TOOLKIT_EMOJI
  ),
  pageEntitySet: formatToolkitTitle(
    PLAIN_LABELS.pageEntitySet,
    'request.pageEntitySet',
    DEFAULT_TOOLKIT_EMOJI
  ),
  cleanEntitySet: formatToolkitTitle(
    PLAIN_LABELS.cleanEntitySet,
    'request.cleanEntitySet',
    DEFAULT_TOOLKIT_EMOJI
  ),
  releaseEntitySet: formatToolkitTitle(
    PLAIN_LABELS.releaseEntitySet,
    'request.releaseEntitySet',
    DEFAULT_TOOLKIT_EMOJI
  ),
  deleteEntitySet: formatToolkitTitle(
    PLAIN_LABELS.deleteEntitySet,
    'request.deleteEntitySet',
    DEFAULT_TOOLKIT_EMOJI
  ),
  compute: formatToolkitTitle(PLAIN_LABELS.compute, 'request.compute', DEFAULT_TOOLKIT_EMOJI),
  datastoreFn: (name: string) =>
    formatToolkitTitle(
      PLAIN_LABELS.datastoreFn(name),
      'request.datastoreFn',
      DEFAULT_TOOLKIT_EMOJI
    ),
  classFn: (name: string) =>
    formatToolkitTitle(PLAIN_LABELS.classFn(name), 'request.classFn', DEFAULT_TOOLKIT_EMOJI),
  classFnGet: (name: string) =>
    formatToolkitTitle(PLAIN_LABELS.classFnGet(name), 'request.classFnGet', DEFAULT_TOOLKIT_EMOJI),
  classFnEntitySet: (name: string) =>
    formatToolkitTitle(
      PLAIN_LABELS.classFnEntitySet(name),
      'request.classFnEntitySet',
      DEFAULT_TOOLKIT_EMOJI
    ),
  singletonFn: (name: string) =>
    formatToolkitTitle(
      PLAIN_LABELS.singletonFn(name),
      'request.singletonFn',
      DEFAULT_TOOLKIT_EMOJI
    ),
  singletonFnGet: (name: string) =>
    formatToolkitTitle(
      PLAIN_LABELS.singletonFnGet(name),
      'request.singletonFnGet',
      DEFAULT_TOOLKIT_EMOJI
    ),
} as const
