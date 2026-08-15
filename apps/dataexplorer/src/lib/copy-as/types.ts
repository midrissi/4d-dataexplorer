export const COPY_AS_FORMAT_IDS = [
  'fourDHttpRequest',
  'fourDHttpRequestClassic',
  'csharpHttpClient',
  'csharpRestSharp',
  'curl',
  'dartDio',
  'dartHttp',
  'goNative',
  'http',
  'javaOkHttp',
  'javaUnirest',
  'jsFetch',
  'jsJquery',
  'jsXhr',
  'kotlinOkHttp',
  'cLibcurl',
  'nodeAxios',
  'nodeNative',
  'nodeRequest',
  'nodeUnirest',
  'objcNsurlSession',
  'ocamlCohttp',
  'phpCurl',
  'phpGuzzle',
  'phpHttpRequest2',
  'phpPeclHttp',
  'powershellRestMethod',
  'pythonHttpClient',
  'pythonRequests',
  'rHttr',
  'rRcurl',
  'rubyNetHttp',
  'rustReqwest',
  'shellHttpie',
  'shellWget',
  'swiftUrlSession',
] as const

export type CopyAsFormatId = (typeof COPY_AS_FORMAT_IDS)[number]

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

export const COPY_AS_FORMATS: CopyAsFormat[] = COPY_AS_FORMAT_IDS.map((id) => ({
  id,
  labelKey: `copyAs.formats.${id}`,
}))

export const DEFAULT_COPY_AS_FORMAT: CopyAsFormatId = 'curl'

export function isCopyAsFormatId(value: string): value is CopyAsFormatId {
  return (COPY_AS_FORMAT_IDS as readonly string[]).includes(value)
}
