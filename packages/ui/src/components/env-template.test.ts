import { describe, expect, it } from 'bun:test'
import { parseEnvTemplateSegments } from './env-template'

describe('parseEnvTemplateSegments', () => {
  it('splits mixed text and variables', () => {
    expect(parseEnvTemplateSegments('{{baseUrl}}/rest/{{path}}')).toEqual([
      { kind: 'variable', key: 'baseUrl', raw: '{{baseUrl}}', offset: 0 },
      { kind: 'text', text: '/rest/', offset: 11 },
      { kind: 'variable', key: 'path', raw: '{{path}}', offset: 17 },
    ])
  })

  it('handles empty string', () => {
    expect(parseEnvTemplateSegments('')).toEqual([{ kind: 'text', text: '', offset: 0 }])
  })

  it('uses base key when filters are present', () => {
    expect(parseEnvTemplateSegments('{{ $randomFirstName | female }}')).toEqual([
      {
        kind: 'variable',
        key: '$randomFirstName',
        raw: '{{ $randomFirstName | female }}',
        offset: 0,
      },
    ])
  })
})
