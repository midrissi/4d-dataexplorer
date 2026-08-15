import { describe, expect, it } from 'bun:test'
import type { NetworkDetails } from '~/store/console'
import type { MethodExecutorSeed } from '~/store/method-executor-types'
import {
  COPY_AS_FORMATS,
  copyableFromMethodSeed,
  copyableFromNetworkDetails,
  emitCopyAsSnippet,
} from './index'
import type { CopyableHttpRequest } from './types'

const jsonPost: CopyableHttpRequest = {
  method: 'POST',
  url: 'https://api.example.com/rest/Employee',
  headers: {
    'Content-Type': 'application/json',
    Host: 'api.example.com',
    'Content-Length': '12',
  },
  body: '{"name":"Ada"}',
  bodyKind: 'json',
}

function network(partial: Partial<NetworkDetails>): NetworkDetails {
  return {
    method: 'GET',
    url: 'https://api.example.com/rest/Employee?$top=1',
    durationMs: 12,
    requestHeaders: {},
    ...partial,
  }
}

describe('copy-as snippets', () => {
  it('emits curl without hop-by-hop headers', async () => {
    const snippet = await emitCopyAsSnippet('curl', jsonPost)
    expect(snippet).toContain('--request POST')
    expect(snippet).toContain('https://api.example.com/rest/Employee')
    expect(snippet).toContain('Content-Type: application/json')
    expect(snippet).not.toContain('Content-Length')
    expect(snippet).not.toContain('Host:')
    expect(snippet).toContain('--data')
    expect(snippet).toContain('{"name":"Ada"}')
  })

  it('emits JavaScript fetch with the JSON body', async () => {
    const snippet = await emitCopyAsSnippet('jsFetch', jsonPost)
    expect(snippet).toContain('fetch(')
    expect(snippet).toContain('https://api.example.com/rest/Employee')
    expect(snippet).toContain("method: 'POST'")
    expect(snippet).toContain('{"name":"Ada"}')
  })

  it('emits 4D.HTTPRequest with JSON Parse', async () => {
    const snippet = await emitCopyAsSnippet('fourDHttpRequest', jsonPost)
    expect(snippet).toContain('4D.HTTPRequest.new($url; $options)')
    expect(snippet).toContain('$options.method:="POST"')
    expect(snippet).toContain('JSON Parse')
    expect(snippet).toContain('$request.wait()')
  })

  it('emits classic HTTP Request with method constant', async () => {
    const snippet = await emitCopyAsSnippet('fourDHttpRequestClassic', jsonPost)
    expect(snippet).toContain('HTTP Request(HTTP POST method;')
    expect(snippet).toContain('APPEND TO ARRAY($headerNames; "Content-Type")')
  })

  it('escapes quotes in 4D strings', async () => {
    const snippet = await emitCopyAsSnippet('fourDHttpRequest', {
      ...jsonPost,
      url: 'https://example.com/say?q="hi"',
      body: null,
      bodyKind: 'none',
    })
    expect(snippet).toContain('$url:="https://example.com/say?q=""hi"""')
  })

  it('emits raw HTTP with Host from the URL', async () => {
    const snippet = await emitCopyAsSnippet('http', jsonPost)
    expect(snippet.startsWith('POST /rest/Employee HTTP/1.1')).toBe(true)
    expect(snippet).toContain('Host: api.example.com')
    expect(snippet).toContain('{"name":"Ada"}')
  })

  it('emits Python requests.post with json=', async () => {
    const snippet = await emitCopyAsSnippet('pythonRequests', jsonPost)
    expect(snippet).toContain('import requests')
    expect(snippet).toContain('requests.post')
    expect(snippet).toContain('json=')
  })

  it('emits curl --form for multipart fields', async () => {
    const snippet = await emitCopyAsSnippet('curl', {
      method: 'POST',
      url: 'https://api.example.com/upload',
      headers: { 'Content-Type': 'multipart/form-data; boundary=abc' },
      body: null,
      bodyKind: 'multipart',
      formFields: [
        { key: 'name', value: 'Ada' },
        { key: 'file', value: '', fileName: 'photo.png' },
      ],
    })
    expect(snippet).toContain('--form name=Ada')
    expect(snippet).toContain('file=@photo.png')
  })

  it('emits Go native, JS XHR, Dart Dio, and PHP Http_Request2', async () => {
    const go = await emitCopyAsSnippet('goNative', jsonPost)
    expect(go).toContain('package main')
    expect(go).toContain('http.NewRequest')

    const xhr = await emitCopyAsSnippet('jsXhr', jsonPost)
    expect(xhr).toContain('XMLHttpRequest')

    const dart = await emitCopyAsSnippet('dartDio', jsonPost)
    expect(dart).toContain('package:dio/dio.dart')
    expect(dart).toContain('dio.request')

    const php = await emitCopyAsSnippet('phpHttpRequest2', jsonPost)
    expect(php).toContain('HTTP_Request2')
    expect(php).toContain('METHOD_POST')
  })

  it('emits a non-empty snippet for every format', async () => {
    for (const format of COPY_AS_FORMATS) {
      const snippet = await emitCopyAsSnippet(format.id, jsonPost)
      expect(snippet.length).toBeGreaterThan(10)
    }
  })
})

describe('copy-as converters', () => {
  it('maps a console network JSON body', () => {
    const request = copyableFromNetworkDetails(
      network({
        method: 'post',
        requestHeaders: { 'Content-Type': 'application/json' },
        requestBody: { name: 'Ada' },
      })
    )
    expect(request.method).toBe('POST')
    expect(request.bodyKind).toBe('json')
    expect(request.body).toContain('"name": "Ada"')
  })

  it('maps multipart and binary placeholders from the console', () => {
    expect(
      copyableFromNetworkDetails(network({ requestBody: '[multipart form data]' })).bodyKind
    ).toBe('multipart')
    expect(
      copyableFromNetworkDetails(network({ requestBody: '[application/octet-stream body]' }))
        .bodyKind
    ).toBe('binary')
  })

  it('builds a method executor POST with $method=entityset', async () => {
    const seed: MethodExecutorSeed = {
      scope: 'dataclass',
      methodName: 'getFirst',
      dataClass: 'Employee',
      allowedOnHTTPGET: false,
      arguments: [],
    }
    const request = copyableFromMethodSeed(seed, 'https://api.example.com')
    expect(request.method).toBe('POST')
    expect(request.url).toContain('/rest/Employee/getFirst')
    expect(request.url).toContain('method=entityset')
    expect(request.headers['Content-Type']).toBe('application/json')
    expect(request.body).toBe('[]')
    expect(await emitCopyAsSnippet('curl', request)).toContain('--request POST')
  })

  it('builds a GET method call with $params', () => {
    const seed: MethodExecutorSeed = {
      scope: 'catalog',
      methodName: 'hello',
      allowedOnHTTPGET: true,
      useGet: true,
      arguments: [{ id: '1', kind: 'string', value: 'Ada' }],
      queryParams: [{ id: 'q', key: '$method', value: 'entityset', enabled: false }],
    }
    const request = copyableFromMethodSeed(seed, 'https://api.example.com')
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/rest/$catalog/hello')
    expect(request.url).toContain('params=')
    expect(request.body).toBeNull()
  })
})
