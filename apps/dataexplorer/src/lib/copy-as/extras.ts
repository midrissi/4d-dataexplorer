import { headersForSnippet } from './headers'
import type { CopyableHttpRequest } from './types'

function escapeDart(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')
}

function dartQuoted(value: string): string {
  return `'${escapeDart(value)}'`
}

function dartMap(entries: { name: string; value: string }[]): string {
  if (entries.length === 0) return '{}'
  const lines = entries.map((entry) => `    ${dartQuoted(entry.name)}: ${dartQuoted(entry.value)},`)
  return `{\n${lines.join('\n')}\n  }`
}

function escapePhp(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function phpQuoted(value: string): string {
  return `'${escapePhp(value)}'`
}

function escapeR(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function rQuoted(value: string): string {
  return `"${escapeR(value)}"`
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])

function dartHttpVerb(method: string): string | null {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'get'
    case 'POST':
      return 'post'
    case 'PUT':
      return 'put'
    case 'PATCH':
      return 'patch'
    case 'DELETE':
      return 'delete'
    case 'HEAD':
      return 'head'
    default:
      return null
  }
}

function emitDartDio(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines = [
    "import 'package:dio/dio.dart';",
    '',
    'void main() async {',
    '  final dio = Dio();',
  ]

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    lines.push('  final form = FormData.fromMap({')
    for (const field of request.formFields) {
      if (field.fileName) {
        lines.push(
          `    ${dartQuoted(field.key)}: await MultipartFile.fromFile(${dartQuoted(field.fileName)}, filename: ${dartQuoted(field.fileName)}),`
        )
      } else {
        lines.push(`    ${dartQuoted(field.key)}: ${dartQuoted(field.value)},`)
      }
    }
    lines.push('  });')
  }

  const optionParts: string[] = [`      method: ${dartQuoted(request.method.toUpperCase())}`]
  if (headers.length > 0 && request.bodyKind !== 'multipart') {
    optionParts.push(`      headers: ${dartMap(headers)}`)
  }

  const args = [
    `    ${dartQuoted(request.url)}`,
    `    options: Options(\n${optionParts.join(',\n')}\n    )`,
  ]

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    args.push('    data: form')
  } else if (request.bodyKind === 'binary') {
    args.push('    data: file')
  } else if (request.body) {
    args.push(`    data: ${dartQuoted(request.body)}`)
  }

  lines.push('  try {')
  lines.push('    final response = await dio.request(')
  lines.push(args.join(',\n'))
  lines.push('    );')
  lines.push('    print(response.data);')
  lines.push('  } on DioException catch (e) {')
  lines.push('    print(e);')
  lines.push('  }')
  lines.push('}')
  return lines.join('\n')
}

function emitDartHttp(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines = ["import 'package:http/http.dart' as http;", '', 'void main() async {']
  const verb = dartHttpVerb(request.method)

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    lines.push(
      `  final request = http.MultipartRequest(${dartQuoted(request.method.toUpperCase())}, Uri.parse(${dartQuoted(request.url)}));`
    )
    if (headers.length > 0) {
      lines.push(`  request.headers.addAll(${dartMap(headers)});`)
    }
    for (const field of request.formFields) {
      if (field.fileName) {
        lines.push(
          `  request.files.add(await http.MultipartFile.fromPath(${dartQuoted(field.key)}, ${dartQuoted(field.fileName)}));`
        )
      } else {
        lines.push(`  request.fields[${dartQuoted(field.key)}] = ${dartQuoted(field.value)};`)
      }
    }
    lines.push('  final streamed = await request.send();')
    lines.push('  final response = await http.Response.fromStream(streamed);')
    lines.push('  print(response.body);')
    lines.push('}')
    return lines.join('\n')
  }

  if (headers.length > 0) {
    lines.push(`  final headers = ${dartMap(headers)};`)
    lines.push('')
  }

  const extra: string[] = []
  if (headers.length > 0) extra.push('headers: headers')
  if (request.bodyKind === 'binary') extra.push('body: file')
  else if (
    request.body &&
    request.method.toUpperCase() !== 'GET' &&
    request.method.toUpperCase() !== 'HEAD'
  ) {
    extra.push(`body: ${dartQuoted(request.body)}`)
  }

  if (verb) {
    const extraArg = extra.length > 0 ? `, ${extra.join(', ')}` : ''
    lines.push(
      `  final response = await http.${verb}(Uri.parse(${dartQuoted(request.url)})${extraArg});`
    )
  } else {
    lines.push(
      `  final request = http.Request(${dartQuoted(request.method.toUpperCase())}, Uri.parse(${dartQuoted(request.url)}));`
    )
    if (headers.length > 0) lines.push('  request.headers.addAll(headers);')
    if (request.body) lines.push(`  request.body = ${dartQuoted(request.body)};`)
    lines.push('  final streamed = await request.send();')
    lines.push('  final response = await http.Response.fromStream(streamed);')
  }
  lines.push('  print(response.body);')
  lines.push('}')
  return lines.join('\n')
}

function phpHttpRequest2Method(method: string): string {
  const upper = method.toUpperCase()
  if (HTTP_METHODS.has(upper) || upper === 'OPTIONS') {
    return `HTTP_Request2::METHOD_${upper}`
  }
  return phpQuoted(upper)
}

function emitPhpHttpRequest2(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines = [
    '<?php',
    "require_once 'HTTP/Request2.php';",
    '',
    '$request = new HTTP_Request2();',
    `$request->setUrl(${phpQuoted(request.url)});`,
    `$request->setMethod(${phpHttpRequest2Method(request.method)});`,
  ]

  if (headers.length > 0 && request.bodyKind !== 'multipart') {
    const pairs = headers
      .map((header) => `  ${phpQuoted(header.name)} => ${phpQuoted(header.value)}`)
      .join(',\n')
    lines.push(`$request->setHeader(array(\n${pairs}\n));`)
  }

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    for (const field of request.formFields) {
      if (field.fileName) {
        lines.push(
          `$request->addUpload(${phpQuoted(field.key)}, ${phpQuoted(field.fileName)}, ${phpQuoted(field.fileName)});`
        )
      } else {
        lines.push(
          `$request->addPostParameter(${phpQuoted(field.key)}, ${phpQuoted(field.value)});`
        )
      }
    }
  } else if (request.bodyKind === 'binary') {
    lines.push("$request->setBody(file_get_contents('/path/to/file'));")
  } else if (request.body) {
    lines.push(`$request->setBody(${phpQuoted(request.body)});`)
  }

  lines.push('')
  lines.push('try {')
  lines.push('  $response = $request->send();')
  lines.push('  echo $response->getBody();')
  lines.push('} catch (HTTP_Request2_Exception $e) {')
  lines.push("  echo 'Error: ' . $e->getMessage();")
  lines.push('}')
  return lines.join('\n')
}

function emitRRcurl(request: CopyableHttpRequest): string {
  const headers = headersForSnippet(request)
  const lines = ['library(RCurl)', '']
  const method = request.method.toUpperCase()

  if (headers.length > 0) {
    const pairs = headers
      .map((header) => `  ${rQuoted(header.name)} = ${rQuoted(header.value)}`)
      .join(',\n')
    lines.push(`headers <- c(\n${pairs}\n)`)
    lines.push('')
  }

  const headerOpt = headers.length > 0 ? 'httpheader = headers' : null

  if (method === 'GET' || method === 'HEAD') {
    const opts = headerOpt ? `, ${headerOpt}` : ''
    lines.push(`res <- getURL(${rQuoted(request.url)}${opts})`)
  } else if (request.bodyKind === 'multipart' && request.formFields?.length) {
    const fields = request.formFields
      .map((field) =>
        field.fileName
          ? `  ${field.key} = fileUpload(filename = ${rQuoted(field.fileName)})`
          : `  ${field.key} = ${rQuoted(field.value)}`
      )
      .join(',\n')
    const opts = headerOpt ? `,\n  .opts = list(${headerOpt})` : ''
    lines.push(`res <- postForm(\n  ${rQuoted(request.url)},\n${fields}${opts}\n)`)
  } else {
    const optParts = [headerOpt]
    if (request.bodyKind === 'binary')
      optParts.push('postfields = readBin("file.bin", "raw", n = file.info("file.bin")$size)')
    else if (request.body) optParts.push(`postfields = ${rQuoted(request.body)}`)
    const opts = optParts.filter(Boolean).join(', ')
    lines.push(
      `res <- postForm(\n  ${rQuoted(request.url)},\n  .opts = list(${opts}),\n  style = "POST"\n)`
    )
  }

  lines.push('cat(res)')
  return lines.join('\n')
}

export function extraSnippetFor(
  format: 'dartDio' | 'dartHttp' | 'phpHttpRequest2' | 'rRcurl',
  request: CopyableHttpRequest
): string {
  switch (format) {
    case 'dartDio':
      return emitDartDio(request)
    case 'dartHttp':
      return emitDartHttp(request)
    case 'phpHttpRequest2':
      return emitPhpHttpRequest2(request)
    case 'rRcurl':
      return emitRRcurl(request)
  }
}
