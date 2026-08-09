import {
  type BuildPostmanCollectionOptions,
  POSTMAN_COLLECTION_SCHEMA,
  type PostmanCollection,
  type PostmanEvent,
  type PostmanItem,
  type PostmanVariable,
} from './types'

const ACCESS_KEY_LOGIN_SCRIPT = [
  '// Sign in with the collection accessKey so session cookies are available.',
  'const baseUrl = (pm.collectionVariables.get("baseUrl") || "").replace(/\\/$/, "");',
  'const accessKey = pm.collectionVariables.get("accessKey");',
  'if (!baseUrl || !accessKey) { return; }',
  '',
  'pm.sendRequest({',
  '  url: baseUrl + "/api/login",',
  '  method: "POST",',
  '  body: {',
  '    mode: "formdata",',
  '    formdata: [{ key: "accessKey", value: accessKey, type: "text" }]',
  '  }',
  '}, function (err) {',
  '  if (err) {',
  '    console.warn("Access-key login failed", err);',
  '  }',
  '});',
]

function buildVariables(options: BuildPostmanCollectionOptions): PostmanVariable[] {
  const { baseUrl, accessKey, username, password } = options.variables
  return [
    { key: 'baseUrl', value: baseUrl.replace(/\/$/, ''), type: 'string' },
    { key: 'accessKey', value: accessKey, type: 'secret' },
    { key: 'username', value: username, type: 'string' },
    { key: 'password', value: password, type: 'secret' },
  ]
}

function buildLoginEvent(): PostmanEvent {
  return {
    listen: 'prerequest',
    script: {
      type: 'text/javascript',
      exec: ACCESS_KEY_LOGIN_SCRIPT,
    },
  }
}

function requestItemFromInput(input: BuildPostmanCollectionOptions['items'][number]): PostmanItem {
  const { item } = input
  return {
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    request: item.request,
  }
}

function groupItemsByTags(
  items: BuildPostmanCollectionOptions['items'],
  untaggedFolderName: string
): PostmanItem[] {
  const folders = new Map<string, PostmanItem[]>()
  const untagged: PostmanItem[] = []

  for (const input of items) {
    const requestItem = requestItemFromInput(input)
    const firstTag = input.tags?.find((tag) => tag.trim())?.trim()
    if (!firstTag) {
      untagged.push(requestItem)
      continue
    }
    const existing = folders.get(firstTag)
    if (existing) existing.push(requestItem)
    else folders.set(firstTag, [requestItem])
  }

  const folderNames = [...folders.keys()].sort((a, b) => a.localeCompare(b))
  const result: PostmanItem[] = folderNames.map((name) => ({
    name,
    item: folders.get(name) ?? [],
  }))

  if (untagged.length > 0) {
    if (result.length === 0) {
      // No tagged folders — keep untagged flat at the top level.
      return untagged
    }
    result.push({ name: untaggedFolderName, item: untagged })
  }

  return result
}

export function buildPostmanCollection(options: BuildPostmanCollectionOptions): PostmanCollection {
  const untaggedFolderName = options.untaggedFolderName ?? 'Untagged'
  const item =
    options.folderMode === 'byTags'
      ? groupItemsByTags(options.items, untaggedFolderName)
      : options.items.map(requestItemFromInput)

  return {
    info: {
      name: options.name,
      ...(options.description?.trim() ? { description: options.description.trim() } : {}),
      schema: POSTMAN_COLLECTION_SCHEMA,
    },
    variable: buildVariables(options),
    ...(options.includeAccessKeyLogin ? { event: [buildLoginEvent()] } : {}),
    item,
  }
}

export function postmanCollectionFilename(collectionName: string): string {
  const slug = collectionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'collection'}.postman_collection.json`
}

export function serializePostmanCollection(collection: PostmanCollection): string {
  return `${JSON.stringify(collection, null, 2)}\n`
}
