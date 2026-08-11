import { describe, expect, it } from 'bun:test'
import {
  isThisTemplateKey,
  listThisSuggestionKeys,
  resolveThisPath,
  stringifyThisValue,
} from './this-context'
import { buildEntityThis, buildHttpThis, buildMethodThis, buildQueryThis } from './this-context-builders'
import {
  resolveEnvTemplates,
  resolveEnvTemplatesDeep,
  resolveEnvTemplatesDeepWithThis,
} from './resolve'
import type { HttpClientRequestDraft } from '~/lib/http-client'

describe('isThisTemplateKey', () => {
  it('matches $this and dotted paths', () => {
    expect(isThisTemplateKey('$this')).toBe(true)
    expect(isThisTemplateKey('$this.firstName')).toBe(true)
    expect(isThisTemplateKey('$this.headers.Authorization')).toBe(true)
    expect(isThisTemplateKey('$timestamp')).toBe(false)
    expect(isThisTemplateKey('this')).toBe(false)
  })
})

describe('resolveThisPath', () => {
  const root = {
    firstName: 'Ada',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    args: ['a', 'b'],
  }

  it('returns the root for bare $this', () => {
    expect(resolveThisPath(root, '$this')).toEqual({ value: root, found: true })
  })

  it('walks dotted paths and array indices', () => {
    expect(resolveThisPath(root, '$this.firstName')).toEqual({ value: 'Ada', found: true })
    expect(resolveThisPath(root, '$this.args.1')).toEqual({ value: 'b', found: true })
  })

  it('matches object keys case-insensitively', () => {
    expect(resolveThisPath(root, '$this.headers.authorization')).toEqual({
      value: 'Bearer x',
      found: true,
    })
    expect(resolveThisPath(root, '$this.headers.Content-Type')).toEqual({
      value: 'application/json',
      found: true,
    })
  })

  it('reports missing paths', () => {
    expect(resolveThisPath(root, '$this.missing')).toEqual({ value: undefined, found: false })
    expect(resolveThisPath(undefined, '$this')).toEqual({ value: undefined, found: false })
  })
})

describe('stringifyThisValue', () => {
  it('rejects strings that still contain templates', () => {
    expect(stringifyThisValue('{{$faker.person.firstName}}')).toBeNull()
    expect(stringifyThisValue('Ada')).toBe('Ada')
    expect(stringifyThisValue(3)).toBe('3')
    expect(stringifyThisValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe('$this in resolveEnvTemplates', () => {
  it('resolves paths from options.this', () => {
    const result = resolveEnvTemplates('Hi {{$this.firstName | upper}}!', {}, {
      this: { firstName: 'Ada' },
    })
    expect(result).toEqual({ text: 'Hi ADA!', unresolved: [] })
  })

  it('does not let env map override $this', () => {
    const result = resolveEnvTemplates('{{$this}}', { $this: 'nope' }, { this: { ok: true } })
    expect(result.text).toBe('{"ok":true}')
    expect(result.unresolved).toEqual([])
  })

  it('leaves unresolved when path is missing', () => {
    const result = resolveEnvTemplates('{{$this.missing}}', {}, { this: { a: 1 } })
    expect(result.text).toBe('{{$this.missing}}')
    expect(result.unresolved).toEqual(['$this.missing'])
  })
})

describe('resolveEnvTemplatesDeepWithThis', () => {
  it('resolves sibling fields across passes', () => {
    const result = resolveEnvTemplatesDeepWithThis(
      {
        firstName: 'Ada',
        email: '{{$this.firstName | lower}}@ex.com',
      },
      {},
      (current) => buildEntityThis(current as Record<string, unknown>)
    )
    expect(result.unresolved).toEqual([])
    expect(result.value).toEqual({
      firstName: 'Ada',
      email: 'ada@ex.com',
    })
  })

  it('rehydrates exact $this leaves', () => {
    const result = resolveEnvTemplatesDeep(
      { embedding: '{{$this.vector}}' } as Record<string, unknown>,
      {},
      { this: { vector: [0.1, 0.2] } }
    )
    expect(result.unresolved).toEqual([])
    expect(result.value).toEqual({ embedding: [0.1, 0.2] })
  })

  it('leaves cyclic $this refs unresolved', () => {
    const result = resolveEnvTemplatesDeepWithThis(
      {
        a: '{{$this.b}}',
        b: '{{$this.a}}',
      },
      {},
      (current) => current
    )
    expect(result.value).toEqual({
      a: '{{$this.b}}',
      b: '{{$this.a}}',
    })
    expect(result.unresolved.length).toBeGreaterThan(0)
  })
})

describe('listThisSuggestionKeys', () => {
  it('always includes $this', () => {
    expect(listThisSuggestionKeys(undefined)).toEqual(['$this'])
    expect(listThisSuggestionKeys({ name: 'x' })).toContain('$this.name')
  })
})

describe('builders', () => {
  it('buildHttpThis exposes headers and path', () => {
    const draft = {
      method: 'GET',
      customMethod: '',
      targetMode: 'custom',
      customOrigin: 'https://example.com',
      path: '/rest/Person',
      params: [{ id: '1', key: 'q', value: 'x', enabled: true }],
      headers: [{ id: '2', key: 'Authorization', value: 'Bearer t', enabled: true }],
      body: {
        mode: 'none',
        formData: [],
        urlencoded: [],
        raw: '',
        rawLanguage: 'json',
        rawContentType: '',
      },
      settings: {
        sendCookies: true,
        timeoutMs: null,
        followRedirects: true,
        maxRedirects: 5,
        skipSsl: false,
        credentials: 'include',
      },
      disabledBuiltInHeaders: [],
    } as unknown as HttpClientRequestDraft
    const view = buildHttpThis(draft)
    expect(view.path).toBe('/rest/Person')
    expect(view.headers).toEqual({ Authorization: 'Bearer t' })
    expect(view.params).toEqual({ q: 'x' })
    expect(String(view.url)).toContain('/rest/Person')
  })

  it('buildMethodThis exposes parent and args', () => {
    const view = buildMethodThis({
      scope: 'dataclass',
      methodName: 'greet',
      dataClass: 'Person',
      arguments: [{ id: '1', kind: 'string', name: 'msg', value: 'hi' }],
    })
    expect(view.parent).toBe('Person')
    expect(view.methodName).toBe('greet')
    expect(view.args).toEqual(['hi'])
  })

  it('buildQueryThis exposes 1-based params', () => {
    const view = buildQueryThis({
      dataclassName: 'Person',
      queryOptions: {
        filter: 'name = :1',
        filterParams: [{ type: 'string', value: 'Ada' }],
        sort: 'name',
        order: 'asc',
        select: '',
        top: 40,
      },
      entitySetId: 'es1',
    })
    expect(view.dataclass).toBe('Person')
    expect(view.params).toMatchObject({ '1': 'Ada', '0': 'Ada' })
    expect(view.entitySetId).toBe('es1')
  })
})
