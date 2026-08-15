import { headersForSnippet, headerValue, looksLikeJson } from './headers'
import type { CopyAsFormatId, CopyableHttpRequest } from './types'

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, `'\\''`)
}

function quoteShell(value: string): string {
  if (value === '') return "''"
  if (/^[A-Za-z0-9_./:?&=-]+$/.test(value)) return value
  return `'${escapeSingleQuotes(value)}'`
}

function escapeFourDString(value: string): string {
  return value.replace(/"/g, '""')
}

function fourDQuoted(value: string): string {
  return `"${escapeFourDString(value)}"`
}

function indentBlock(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n')
}

function jsonForLanguage(body: string): string | null {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return null
  }
}

function emitCurl(request: CopyableHttpRequest): string {
  const lines = [`curl --location --request ${request.method} ${quoteShell(request.url)}`]
  for (const header of headersForSnippet(request)) {
    lines.push(`--header ${quoteShell(`${header.name}: ${header.value}`)}`)
  }
  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    for (const field of request.formFields) {
      const part = field.fileName
        ? `${field.key}=@${field.fileName}`
        : `${field.key}=${field.value}`
      lines.push(`--form ${quoteShell(part)}`)
    }
  } else if (request.bodyKind === 'binary') {
    lines.push(`--data-binary ${quoteShell(request.body || '@file.bin')}`)
  } else if (request.body) {
    lines.push(`--data-raw ${quoteShell(request.body)}`)
  }
  return `${lines[0]}${lines
    .slice(1)
    .map((line) => ` \\\n  ${line}`)
    .join('')}`
}

function emitHttp(request: CopyableHttpRequest): string {
  let pathname = request.url
  let host = ''
  try {
    const parsed = new URL(request.url)
    pathname = `${parsed.pathname}${parsed.search}`
    host = parsed.host
  } catch {
    // keep raw URL as the request target
  }
  const lines = [`${request.method} ${pathname || '/'} HTTP/1.1`]
  if (host) lines.push(`Host: ${host}`)
  for (const header of headersForSnippet(request)) {
    lines.push(`${header.name}: ${header.value}`)
  }
  if (request.body) {
    lines.push('')
    lines.push(request.body)
  }
  return lines.join('\n')
}

function emitJsFetch(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines: string[] = []
  const options: string[] = []

  if (request.method.toUpperCase() !== 'GET') {
    options.push(`method: ${JSON.stringify(request.method)}`)
  }

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    lines.push('const form = new FormData()')
    for (const field of request.formFields) {
      if (field.fileName) {
        lines.push(`form.append(${JSON.stringify(field.key)}, file) // ${field.fileName}`)
      } else {
        lines.push(`form.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)})`)
      }
    }
    lines.push('')
    options.push('body: form')
  } else if (
    request.body &&
    looksLikeJson(request.body, headerValue(request.headers, 'content-type'))
  ) {
    const pretty = jsonForLanguage(request.body)
    if (pretty) {
      options.push(`body: JSON.stringify(${pretty})`)
    } else {
      options.push(`body: ${JSON.stringify(request.body)}`)
    }
  } else if (request.bodyKind === 'binary') {
    options.push('body: file // attach the binary payload')
  } else if (request.body) {
    options.push(`body: ${JSON.stringify(request.body)}`)
  }

  if (headers.length > 0 && request.bodyKind !== 'multipart') {
    const headerLines = headers
      .map((header, index) => {
        const comma = index < headers.length - 1 ? ',' : ''
        return `    ${JSON.stringify(header.name)}: ${JSON.stringify(header.value)}${comma}`
      })
      .join('\n')
    options.push(`headers: {\n${headerLines}\n  }`)
  }

  const optionBlock =
    options.length === 0 ? '' : `, {\n${options.map((option) => `  ${option}`).join(',\n')}\n}`
  lines.push(`const response = await fetch(${JSON.stringify(request.url)}${optionBlock})`)
  lines.push('const data = await response.json()')
  return lines.join('\n')
}

function emitPython(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines = ['import requests', '']
  const args = [`    ${JSON.stringify(request.url)}`]
  if (request.method.toUpperCase() !== 'GET') {
    // method is in requests.get/post/... or requests.request
  }
  if (headers.length > 0 && request.bodyKind !== 'multipart') {
    const headerLines = headers
      .map((header, index) => {
        const comma = index < headers.length - 1 ? ',' : ''
        return `        ${JSON.stringify(header.name)}: ${JSON.stringify(header.value)}${comma}`
      })
      .join('\n')
    args.push(`    headers={\n${headerLines}\n    }`)
  }

  const method = request.method.toUpperCase()
  const fn =
    method === 'GET'
      ? 'get'
      : method === 'POST'
        ? 'post'
        : method === 'PUT'
          ? 'put'
          : method === 'PATCH'
            ? 'patch'
            : method === 'DELETE'
              ? 'delete'
              : method === 'HEAD'
                ? 'head'
                : null

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    const fields: string[] = []
    const files: string[] = []
    for (const field of request.formFields) {
      if (field.fileName) {
        files.push(
          `        ${JSON.stringify(field.key)}: open(${JSON.stringify(field.fileName)}, "rb")`
        )
      } else {
        fields.push(`        ${JSON.stringify(field.key)}: ${JSON.stringify(field.value)}`)
      }
    }
    if (fields.length > 0) args.push(`    data={\n${fields.join(',\n')}\n    }`)
    if (files.length > 0) args.push(`    files={\n${files.join(',\n')}\n    }`)
  } else if (
    request.body &&
    looksLikeJson(request.body, headerValue(request.headers, 'content-type'))
  ) {
    const pretty = jsonForLanguage(request.body)
    args.push(
      pretty
        ? `    json=${indentBlock(pretty, '    ').trimStart()}`
        : `    data=${JSON.stringify(request.body)}`
    )
  } else if (request.bodyKind === 'binary') {
    args.push('    data=open("file.bin", "rb")')
  } else if (request.body) {
    args.push(`    data=${JSON.stringify(request.body)}`)
  }

  if (fn) {
    lines.push(`response = requests.${fn}(`)
  } else {
    args.unshift(`    ${JSON.stringify(request.method)}`)
    lines.push('response = requests.request(')
  }
  lines.push(args.join(',\n'))
  lines.push(')')
  lines.push('print(response.text)')
  return lines.join('\n')
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

export function emitCopyAsSnippet(format: CopyAsFormatId, request: CopyableHttpRequest): string {
  switch (format) {
    case 'fourDHttpRequest':
      return emitFourDHttpRequest(request)
    case 'fourDHttpRequestClassic':
      return emitFourDHttpRequestClassic(request)
    case 'curl':
      return emitCurl(request)
    case 'http':
      return emitHttp(request)
    case 'jsFetch':
      return emitJsFetch(request)
    case 'pythonRequests':
      return emitPython(request)
  }
}
