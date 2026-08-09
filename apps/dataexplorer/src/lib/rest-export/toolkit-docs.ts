import { officialDocsMarkdown } from './4d-docs-pages'
import type { ToolkitEmojiKey } from './toolkit-emoji'
import type { ToolkitNode, ToolkitQueryParam } from './toolkit-types'

/** Unversioned 4D REST docs (tracks latest). @see https://developer.4d.com/docs/category/rest-api */
export const REST_DOCS_BASE = 'https://developer.4d.com/docs/REST'

export type ToolkitDocRef = {
  url: string
  description: string
}

export const TOOLKIT_DOCS_BY_EMOJI_KEY: Partial<Record<ToolkitEmojiKey, ToolkitDocRef>> = {
  'request.authentify': {
    url: `${REST_DOCS_BASE}/authUsers`,
    description:
      'Call the exposed ds.authentify() datastore function to check credentials and set session privileges (force login). POST /rest/$catalog/authentify with parameters in the JSON body.',
  },
  'request.directoryLogin': {
    url: `${REST_DOCS_BASE}/directory`,
    description:
      '$directory/login opens a REST session and logs in the user. Pass username-4D, password-4D, and optional session-4D-length headers on a POST request.',
  },
  'request.catalog': {
    url: `${REST_DOCS_BASE}/catalog`,
    description:
      'The catalog describes all the dataclasses, attributes, and interprocess (shared) singletons available in the project. GET /rest/$catalog returns exposed dataclasses with structure and data URIs.',
  },
  'request.catalogAll': {
    url: `${REST_DOCS_BASE}/catalog`,
    description:
      '$catalog/$all returns shared singletons (if any) and detailed information about all dataclasses and their attributes.',
  },
  'request.catalogAllMetadata': {
    url: `${REST_DOCS_BASE}/catalog`,
    description:
      '$catalog/$all with $metadata=full returns the full catalog, including attribute metadata for every exposed dataclass.',
  },
  'request.catalogDataClass': {
    url: `${REST_DOCS_BASE}/catalog`,
    description:
      '$catalog/{dataClass} returns information about a dataclass and its attributes, methods, and primary key.',
  },
  'request.serverInfo': {
    url: `${REST_DOCS_BASE}/info`,
    description:
      '$info returns information about the entity sets currently stored in 4D Server’s cache as well as user sessions.',
  },
  'request.upload': {
    url: `${REST_DOCS_BASE}/upload`,
    description:
      '$upload returns an ID of the file uploaded to the server. Pass $rawPict=true for images or $binary=true for other files, then assign the ID with $method=update.',
  },
  'request.list': {
    url: `${REST_DOCS_BASE}/dataClass`,
    description:
      '{dataClass} returns entities for the dataclass (first 100 by default). Use $filter, $top/$limit, $skip, $orderby, and $attributes to refine the selection.',
  },
  'request.getByKey': {
    url: `${REST_DOCS_BASE}/dataClass`,
    description:
      '{dataClass}({key}) returns the entity whose primary key is {key}. The key is the value of the attribute defined as the dataclass primary key.',
  },
  'request.create': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=update creates one or more entities. POST JSON to /{dataClass}/?$method=update without a __KEY to insert.',
  },
  'request.update': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=update updates one or more entities. Include __KEY and __STAMP so 4D can detect concurrent modifications.',
  },
  'request.deleteByKey': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=delete deletes the current entity. POST /{dataClass}({key})?$method=delete to remove a single entity by primary key.',
  },
  'request.deleteByFilter': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=delete deletes the entity selection matching $filter (e.g. POST /Employee?$filter="ID=11"&$method=delete).',
  },
  'request.deleteAll': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=delete on the dataclass without a filter deletes every entity. Destructive — use with care.',
  },
  'request.createEntitySet': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=entityset creates an entity set in 4D Server’s cache from the collection defined in the request. Default timeout is two hours; override with $timeout.',
  },
  'request.pageEntitySet': {
    url: `${REST_DOCS_BASE}/entityset`,
    description:
      'After creating an entity set with $method=entityset, retrieve it with $entityset/{entitySetID}. You can also apply $clean, $expand, $filter, $orderby, $skip, or $top/$limit.',
  },
  'request.cleanEntitySet': {
    url: `${REST_DOCS_BASE}/clean`,
    description:
      '$clean=true creates a new entity set from an existing one without deleted-entity references. Follow with $method=entityset to store the cleaned set.',
  },
  'request.releaseEntitySet': {
    url: `${REST_DOCS_BASE}/method`,
    description:
      '$method=release releases an existing entity set stored in 4D Server’s cache (GET /{dataClass}/$entityset/{id}?$method=release).',
  },
  'request.deleteEntitySet': {
    url: `${REST_DOCS_BASE}/method`,
    description: '$method=delete on $entityset/{id} deletes the entities in that cached selection.',
  },
  'request.compute': {
    url: `${REST_DOCS_BASE}/compute`,
    description:
      '$compute calculates on a specific attribute (sum, average, count, min, max, or $all). Example: GET /Employee/salary/?$compute=sum.',
  },
  'request.datastoreFn': {
    url: `${REST_DOCS_BASE}/classFunctions`,
    description:
      'Call an exposed datastore class function with POST /rest/$catalog/{Function}. Parameters go in the JSON body.',
  },
  'request.classFn': {
    url: `${REST_DOCS_BASE}/classFunctions`,
    description:
      'Call exposed ORDA class functions: /{dataClass}/{Function} (dataclass or entitySelection), /{dataClass}({key})/{Function} (entity). Parameters go in the POST body.',
  },
  'request.classFnGet': {
    url: `${REST_DOCS_BASE}/classFunctions`,
    description:
      "Functions declared with onHTTPGet can be called with GET. Pass parameters in the URL as $params='[...].'",
  },
  'request.classFnEntitySet': {
    url: `${REST_DOCS_BASE}/classFunctions`,
    description:
      'Call an entitySelection class function on a cached set: /{dataClass}/{Function}/$entityset/{entitySetID}.',
  },
  'request.singletonFn': {
    url: `${REST_DOCS_BASE}/singleton`,
    description:
      'Call exposed functions of shared singletons with POST /rest/$singleton/{Class}/{Function}. Only functions marked exposed can be called from REST.',
  },
  'request.singletonFnGet': {
    url: `${REST_DOCS_BASE}/singleton`,
    description:
      "Singleton functions declared with onHTTPGet can be called with GET /rest/$singleton/{Class}/{Function}?$params='[...].'",
  },
}

export const REST_QUERY_DOCS: Record<string, ToolkitDocRef> = {
  $filter: {
    url: `${REST_DOCS_BASE}/filter`,
    description:
      'Allows to query the data in a dataclass or method (e.g. $filter="firstName!=\'\' AND salary>30000").',
  },
  $top: {
    url: `${REST_DOCS_BASE}/top_$limit`,
    description: 'Limits the number of entities to return (e.g. $top=50). Alias of $limit.',
  },
  $limit: {
    url: `${REST_DOCS_BASE}/top_$limit`,
    description: 'Limits the number of entities to return. Alias of $top.',
  },
  $skip: {
    url: `${REST_DOCS_BASE}/skip`,
    description: 'Starts the entity defined by this number in the collection (e.g. $skip=10).',
  },
  $orderby: {
    url: `${REST_DOCS_BASE}/orderby`,
    description:
      'Sorts the data returned by the attribute and sorting order (e.g. $orderby="lastName desc, salary asc").',
  },
  $attributes: {
    url: `${REST_DOCS_BASE}/attributes`,
    description:
      'Selects the attribute(s) to get from the dataclass (e.g. $attributes=name,city or $attributes=employees.lastname).',
  },
  $method: {
    url: `${REST_DOCS_BASE}/method`,
    description:
      'Defines the operation to execute with the returned entity or entity selection (update, delete, entityset, release, …).',
  },
  $timeout: {
    url: `${REST_DOCS_BASE}/timeout`,
    description:
      'Defines the number of seconds to save an entity set in 4D Server’s cache (e.g. $timeout=1800).',
  },
  $clean: {
    url: `${REST_DOCS_BASE}/clean`,
    description:
      'Creates a new entity set from an existing one without deleted entities ($clean=true).',
  },
  $compute: {
    url: `${REST_DOCS_BASE}/compute`,
    description: 'Calculate on a specific attribute: sum, average, count, min, max, or $all.',
  },
  $params: {
    url: `${REST_DOCS_BASE}/classFunctions`,
    description: 'JSON array of function parameters for GET calls to onHTTPGet class functions.',
  },
  $metadata: {
    url: `${REST_DOCS_BASE}/catalog`,
    description: 'Pass $metadata=full with $catalog/$all to include full attribute metadata.',
  },
}

export function docsForEmojiKey(key?: ToolkitEmojiKey): ToolkitDocRef | undefined {
  if (!key) return undefined
  return TOOLKIT_DOCS_BY_EMOJI_KEY[key]
}

export function formatDocsDescription(
  description: string | undefined,
  docsUrl: string | undefined
): string | undefined {
  const parts = [description?.trim(), docsUrl ? `[4D Docs](${docsUrl})` : undefined].filter(Boolean)
  return parts.length > 0 ? parts.join('\n\n') : undefined
}

/** Full official page markdown for Postman Docs; falls back to the short summary + link. */
export function formatPostmanRequestDocs(
  description: string | undefined,
  docsUrl: string | undefined
): string | undefined {
  return officialDocsMarkdown(docsUrl) ?? formatDocsDescription(description, docsUrl)
}

export function applyToolkitDocs(nodes: ToolkitNode[], includeDocs: boolean): ToolkitNode[] {
  if (!includeDocs) return nodes
  return nodes.map((node) => {
    if (node.type === 'folder') {
      return { ...node, children: applyToolkitDocs(node.children, true) }
    }
    const docs = docsForEmojiKey(node.operation.emojiKey)
    const query = applyQueryDocs(node.operation.query)
    const description =
      [node.operation.description, docs?.description].filter(Boolean).join('\n\n') || undefined
    return {
      ...node,
      operation: {
        ...node.operation,
        ...(description ? { description } : {}),
        ...(docs ? { docsUrl: docs.url } : {}),
        ...(query ? { query } : {}),
      },
    }
  })
}

function applyQueryDocs(query: ToolkitQueryParam[] | undefined): ToolkitQueryParam[] | undefined {
  if (!query) return undefined
  return query.map((param) => {
    const docs = REST_QUERY_DOCS[param.key]
    if (!docs) return param
    return { ...param, description: docs.description }
  })
}
