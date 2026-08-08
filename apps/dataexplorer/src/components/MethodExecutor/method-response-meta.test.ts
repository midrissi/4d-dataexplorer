import { describe, expect, it } from 'bun:test'
import { FunctionCallResult } from '@4d/rest'
import {
  contentTypeFromHeaders,
  headerEntriesFromMeta,
  isFailedHttpStatus,
  methodResponseMetaFromCall,
} from './method-response-meta'

describe('methodResponseMetaFromCall', () => {
  it('maps FunctionCallResult accessors into status, time, and headers', () => {
    const res = new FunctionCallResult({
      body: { result: 1 },
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
      durationMs: 18.7,
    })

    const meta = methodResponseMetaFromCall(res)
    expect(meta.status).toBe(201)
    expect(meta.statusText).toBe('Created')
    expect(meta.durationMs).toBe(18.7)
    expect(contentTypeFromHeaders(meta.headers)).toBe('application/json')
    expect(meta.headers['x-trace'] ?? meta.headers['X-Trace']).toBe('abc')
  })
})

describe('contentTypeFromHeaders', () => {
  it('reads Content-Type case-insensitively', () => {
    expect(contentTypeFromHeaders({ 'Content-Type': 'application/json' })).toBe('application/json')
    expect(contentTypeFromHeaders({ 'content-type': 'text/plain' })).toBe('text/plain')
  })
})

describe('headerEntriesFromMeta', () => {
  it('flattens headers for the headers tab', () => {
    expect(headerEntriesFromMeta({ Accept: 'application/json', Server: '4D' })).toEqual([
      { key: 'Accept', value: 'application/json' },
      { key: 'Server', value: '4D' },
    ])
  })
})

describe('isFailedHttpStatus', () => {
  it('treats 4xx/5xx as failed', () => {
    expect(isFailedHttpStatus(200)).toBe(false)
    expect(isFailedHttpStatus(399)).toBe(false)
    expect(isFailedHttpStatus(400)).toBe(true)
    expect(isFailedHttpStatus(500)).toBe(true)
  })
})
