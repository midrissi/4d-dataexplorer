import { describe, expect, it } from 'bun:test'
import { changeRuntimeArgumentKind } from './runtime-argument-kind'

describe('changeRuntimeArgumentKind', () => {
  it('converts number to string keeping the digits', () => {
    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'number', name: ':1', value: '0' }, 'string')
    ).toEqual({ id: '1', kind: 'string', name: ':1', value: '0', sourceType: undefined })
  })

  it('converts string digits to number', () => {
    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'string', name: ':1', value: '42.5' }, 'number')
    ).toEqual({ id: '1', kind: 'number', name: ':1', value: '42.5', sourceType: undefined })
  })

  it('falls back to 0 when string cannot be a number', () => {
    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'string', name: ':1', value: 'hello' }, 'number')
    ).toMatchObject({ kind: 'number', value: '0' })
  })

  it('converts boolean to string and back', () => {
    const asString = changeRuntimeArgumentKind(
      { id: '1', kind: 'boolean', name: ':1', value: true },
      'string'
    )
    expect(asString).toMatchObject({ kind: 'string', value: 'true' })
    expect(changeRuntimeArgumentKind(asString, 'boolean')).toMatchObject({
      kind: 'boolean',
      value: true,
    })
  })

  it('converts number to boolean using zero/non-zero', () => {
    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'number', name: ':1', value: '0' }, 'boolean')
    ).toMatchObject({ kind: 'boolean', value: false })
    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'number', name: ':1', value: '3' }, 'boolean')
    ).toMatchObject({ kind: 'boolean', value: true })
  })

  it('converts ISO date prefix and wraps plain text as JSON custom', () => {
    expect(
      changeRuntimeArgumentKind(
        { id: '1', kind: 'string', name: ':1', value: '2013-11-20T12:00:00Z' },
        'date'
      )
    ).toMatchObject({ kind: 'date', value: '2013-11-20' })

    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'string', name: ':1', value: 'hello' }, 'custom')
    ).toMatchObject({ kind: 'custom', value: '"hello"' })
  })

  it('carries key text into entity when switching from scalar', () => {
    expect(
      changeRuntimeArgumentKind({ id: '1', kind: 'number', name: ':1', value: '99' }, 'entity')
    ).toMatchObject({ kind: 'entity', key: '99', dataClass: '' })
  })
})
