import { extraSnippetFor } from './extras'
import { headersForSnippet, headerValue, looksLikeJson } from './headers'
import { toHarRequest } from './to-har'
import type { CopyAsFormatId, CopyableHttpRequest } from './types'

type HttpSnippetClient = { target: string; client: string }

const HTTP_SNIPPET_CLIENTS: Partial<Record<CopyAsFormatId, HttpSnippetClient>> = {
  csharpHttpClient: { target: 'csharp', client: 'httpclient' },
  csharpRestSharp: { target: 'csharp', client: 'restsharp' },
  curl: { target: 'shell', client: 'curl' },
  goNative: { target: 'go', client: 'native' },
  http: { target: 'http', client: 'http1.1' },
  javaOkHttp: { target: 'java', client: 'okhttp' },
  javaUnirest: { target: 'java', client: 'unirest' },
  jsFetch: { target: 'javascript', client: 'fetch' },
  jsJquery: { target: 'javascript', client: 'jquery' },
  jsXhr: { target: 'javascript', client: 'xhr' },
  kotlinOkHttp: { target: 'kotlin', client: 'okhttp' },
  cLibcurl: { target: 'c', client: 'libcurl' },
  nodeAxios: { target: 'node', client: 'axios' },
  nodeNative: { target: 'node', client: 'native' },
  nodeRequest: { target: 'node', client: 'request' },
  nodeUnirest: { target: 'node', client: 'unirest' },
  objcNsurlSession: { target: 'objc', client: 'nsurlsession' },
  ocamlCohttp: { target: 'ocaml', client: 'cohttp' },
  phpCurl: { target: 'php', client: 'curl' },
  phpGuzzle: { target: 'php', client: 'guzzle' },
  phpPeclHttp: { target: 'php', client: 'http2' },
  powershellRestMethod: { target: 'powershell', client: 'restmethod' },
  pythonHttpClient: { target: 'python', client: 'python3' },
  pythonRequests: { target: 'python', client: 'requests' },
  rHttr: { target: 'r', client: 'httr' },
  rubyNetHttp: { target: 'ruby', client: 'native' },
  rustReqwest: { target: 'rust', client: 'reqwest' },
  shellHttpie: { target: 'shell', client: 'httpie' },
  shellWget: { target: 'shell', client: 'wget' },
  swiftUrlSession: { target: 'swift', client: 'nsurlsession' },
}

function escapeFourDString(value: string): string {
  return value.replace(/"/g, '""')
}

function fourDQuoted(value: string): string {
  return `"${escapeFourDString(value)}"`
}

function fourDHeadersObject(request: CopyableHttpRequest): string | null {
  const headers = headersForSnippet(request)
  if (headers.length === 0) return null
  const pairs = headers
    .map((header) => `${fourDQuoted(header.name)}; ${fourDQuoted(header.value)}`)
    .join('; ')
  return `New object(${pairs})`
}

function fourDHttpMethodConstant(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'HTTP GET method'
    case 'POST':
      return 'HTTP POST method'
    case 'PUT':
      return 'HTTP PUT method'
    case 'DELETE':
      return 'HTTP DELETE method'
    case 'HEAD':
      return 'HTTP HEAD method'
    default:
      return fourDQuoted(method.toUpperCase())
  }
}

function emitFourDHttpRequest(request: CopyableHttpRequest): string {
  const lines = [
    'var $url : Text',
    'var $options : Object',
    'var $request : 4D.HTTPRequest',
    '',
    `$url:=${fourDQuoted(request.url)}`,
    '$options:=New object',
    `$options.method:=${fourDQuoted(request.method.toUpperCase())}`,
  ]
  const headers = fourDHeadersObject(request)
  if (headers) lines.push(`$options.headers:=${headers}`)

  if (request.bodyKind === 'multipart') {
    lines.push('// Multipart fields must be built as a Blob / form payload before sending.')
  } else if (request.bodyKind === 'binary') {
    lines.push('$options.body:=File("/path/to/file").getContent()')
  } else if (
    request.body &&
    looksLikeJson(request.body, headerValue(request.headers, 'content-type'))
  ) {
    lines.push(`$options.body:=JSON Parse(${fourDQuoted(request.body)})`)
  } else if (request.body) {
    lines.push(`$options.body:=${fourDQuoted(request.body)}`)
  }

  lines.push('$request:=4D.HTTPRequest.new($url; $options)')
  lines.push('$request.wait()')
  return lines.join('\n')
}

function emitFourDHttpRequestClassic(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines = [
    'var $url; $body; $response : Text',
    'var $status : Integer',
    'ARRAY TEXT($headerNames; 0)',
    'ARRAY TEXT($headerValues; 0)',
  ]
  if (headers.length > 0) {
    lines.push('')
    for (const header of headers) {
      lines.push(`APPEND TO ARRAY($headerNames; ${fourDQuoted(header.name)})`)
      lines.push(`APPEND TO ARRAY($headerValues; ${fourDQuoted(header.value)})`)
    }
  }
  lines.push('')
  lines.push(`$url:=${fourDQuoted(request.url)}`)
  if (request.bodyKind === 'binary' || request.bodyKind === 'multipart') {
    lines.push('// Set $body to the file bytes or form payload before calling HTTP Request.')
    lines.push('$body:=""')
  } else {
    lines.push(`$body:=${fourDQuoted(request.body ?? '')}`)
  }
  lines.push(
    `$status:=HTTP Request(${fourDHttpMethodConstant(request.method)}; $url; $body; $response; $headerNames; $headerValues)`
  )
  return lines.join('\n')
}

type HttpSnippetCtor = new (
  input: ReturnType<typeof toHarRequest>
) => {
  convert: (
    target: string,
    client?: string,
    options?: { indent?: string }
  ) => string | false | string[]
}

function unwrapHTTPSnippet(mod: unknown): HttpSnippetCtor {
  if (typeof mod === 'function') return mod as HttpSnippetCtor
  if (mod && typeof mod === 'object') {
    const rec = mod as { HTTPSnippet?: unknown; default?: unknown }
    if (typeof rec.HTTPSnippet === 'function') return rec.HTTPSnippet as HttpSnippetCtor
    if (rec.default) return unwrapHTTPSnippet(rec.default)
  }
  throw new Error('HTTP snippet generator is unavailable')
}

async function loadHTTPSnippet(): Promise<HttpSnippetCtor> {
  return unwrapHTTPSnippet(await import('httpsnippet'))
}

async function emitLibrarySnippet(
  format: CopyAsFormatId,
  request: CopyableHttpRequest
): Promise<string> {
  const client = HTTP_SNIPPET_CLIENTS[format]
  if (!client) throw new Error(`Unsupported copy-as format: ${format}`)
  const HTTPSnippet = await loadHTTPSnippet()
  const result = new HTTPSnippet(toHarRequest(request)).convert(client.target, client.client, {
    indent: '  ',
  })
  if (typeof result !== 'string' || result.length === 0) {
    throw new Error(`Failed to generate ${format} snippet`)
  }
  return result
}

export async function emitCopyAsSnippet(
  format: CopyAsFormatId,
  request: CopyableHttpRequest
): Promise<string> {
  switch (format) {
    case 'fourDHttpRequest':
      return emitFourDHttpRequest(request)
    case 'fourDHttpRequestClassic':
      return emitFourDHttpRequestClassic(request)
    case 'dartDio':
    case 'dartHttp':
    case 'phpHttpRequest2':
    case 'rRcurl':
      return extraSnippetFor(format, request)
    default:
      return emitLibrarySnippet(format, request)
  }
}
