/** Minimal Postman Collection v2.1 shapes used by the favourites exporter. */

export const POSTMAN_COLLECTION_SCHEMA =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' as const

export type PostmanVariable = {
  key: string
  value: string
  type?: 'string' | 'default' | 'any' | 'secret'
}

export type PostmanHeader = {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export type PostmanQueryParam = {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export type PostmanUrl = {
  raw: string
  host?: string[]
  path?: string[]
  query?: PostmanQueryParam[]
}

export type PostmanFormDataField =
  | { key: string; value: string; type: 'text'; disabled?: boolean; contentType?: string }
  | { key: string; type: 'file'; src?: string; disabled?: boolean; contentType?: string }

export type PostmanBody =
  | { mode: 'raw'; raw: string; options?: { raw: { language: string } } }
  | { mode: 'urlencoded'; urlencoded: Array<{ key: string; value: string; disabled?: boolean }> }
  | { mode: 'formdata'; formdata: PostmanFormDataField[] }
  | { mode: 'file'; file: { src?: string } }

export type PostmanDescription =
  | string
  | {
      content: string
      type?: 'text/plain' | 'text/markdown'
    }

export type PostmanRequest = {
  method: string
  header: PostmanHeader[]
  url: PostmanUrl
  body?: PostmanBody
  description?: PostmanDescription
}

export type PostmanEvent = {
  listen: 'prerequest' | 'test'
  script: {
    type: 'text/javascript'
    exec: string[]
  }
}

export type PostmanItem =
  | {
      name: string
      description?: PostmanDescription
      request: PostmanRequest
      event?: PostmanEvent[]
    }
  | {
      name: string
      description?: PostmanDescription
      item: PostmanItem[]
    }

export type PostmanCollection = {
  info: {
    name: string
    description?: string
    schema: typeof POSTMAN_COLLECTION_SCHEMA
  }
  variable?: PostmanVariable[]
  event?: PostmanEvent[]
  item: PostmanItem[]
}

export type PostmanFolderMode = 'flat' | 'byTags'

export type PostmanExportVariableValues = {
  baseUrl: string
  accessKey: string
  username: string
  password: string
}

export type PostmanExportItemInput = {
  id: string
  /** Postman request / folder item name. */
  name: string
  /** Custom favourite name only — when set, list UI matches Favourites (name + signature tooltip). */
  displayName?: string
  /** Optional secondary / signature line in the export selection list. */
  listDetail?: string
  /** Optional method/scope badge for the selection list. */
  badgeLabel?: string
  badgeClassName?: string
  description?: string
  tags?: string[]
  item: PostmanItem & { request: PostmanRequest }
}

export type BuildPostmanCollectionOptions = {
  name: string
  description?: string
  variables: PostmanExportVariableValues
  includeAccessKeyLogin: boolean
  folderMode: PostmanFolderMode
  /** Only these IDs are included (already filtered by the modal). */
  items: PostmanExportItemInput[]
  untaggedFolderName?: string
}
