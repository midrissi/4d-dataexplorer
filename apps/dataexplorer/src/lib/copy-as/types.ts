export type CopyAsFormatId =
  | 'fourDHttpRequest'
  | 'fourDHttpRequestClassic'
  | 'curl'
  | 'http'
  | 'jsFetch'
  | 'pythonRequests'

export type CopyableBodyKind = 'none' | 'text' | 'json' | 'urlencoded' | 'multipart' | 'binary'

export type CopyableFormField = {
  key: string
  value: string
  /** Present when the field is a file part. */
  fileName?: string
}

export type CopyableHttpRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  bodyKind: CopyableBodyKind
  formFields?: CopyableFormField[]
}

export type CopyAsFormat = {
  id: CopyAsFormatId
  /** i18n key under `copyAs.formats.*` */
  labelKey: `copyAs.formats.${CopyAsFormatId}`
}

export const COPY_AS_FORMATS: CopyAsFormat[] = [
  { id: 'fourDHttpRequest', labelKey: 'copyAs.formats.fourDHttpRequest' },
  { id: 'fourDHttpRequestClassic', labelKey: 'copyAs.formats.fourDHttpRequestClassic' },
  { id: 'curl', labelKey: 'copyAs.formats.curl' },
  { id: 'http', labelKey: 'copyAs.formats.http' },
  { id: 'jsFetch', labelKey: 'copyAs.formats.jsFetch' },
  { id: 'pythonRequests', labelKey: 'copyAs.formats.pythonRequests' },
]

export const DEFAULT_COPY_AS_FORMAT: CopyAsFormatId = 'curl'

export function isCopyAsFormatId(value: string): value is CopyAsFormatId {
  return COPY_AS_FORMATS.some((format) => format.id === value)
}
