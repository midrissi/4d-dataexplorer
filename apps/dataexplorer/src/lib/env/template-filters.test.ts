import { describe, expect, it } from 'bun:test'
import {
  applyTransforms,
  extractGeneratorOptions,
  hasGeneratorOptionFilters,
} from './template-filters'

describe('extractGeneratorOptions', () => {
  it('extracts gender and leaves transforms', () => {
    const result = extractGeneratorOptions([
      { name: 'female', args: [] },
      { name: 'upper', args: [] },
    ])
    expect(result).toEqual({
      options: { gender: 'female' },
      transforms: [{ name: 'upper', args: [] }],
    })
  })

  it('parses numeric between', () => {
    expect(extractGeneratorOptions([{ name: 'between', args: ['10', '5'] }])).toEqual({
      options: { min: 5, max: 10 },
      transforms: [],
    })
  })

  it('parses date between', () => {
    expect(
      extractGeneratorOptions([{ name: 'between', args: ['2025-01-01', '2020-01-01'] }])
    ).toEqual({
      options: { after: '2020-01-01', before: '2025-01-01' },
      transforms: [],
    })
  })

  it('rejects unknown filters', () => {
    expect(extractGeneratorOptions([{ name: 'nope', args: [] }])).toBeNull()
  })

  it('rejects invalid min args', () => {
    expect(extractGeneratorOptions([{ name: 'min', args: ['abc'] }])).toBeNull()
  })
})

describe('applyTransforms', () => {
  it('applies case transforms', () => {
    expect(applyTransforms('Hello World', [{ name: 'upper', args: [] }])).toBe('HELLO WORLD')
    expect(applyTransforms('Hello World', [{ name: 'lower', args: [] }])).toBe('hello world')
    expect(applyTransforms('Hello World', [{ name: 'snake', args: [] }])).toBe('hello_world')
    expect(applyTransforms('Hello World', [{ name: 'kebab', args: [] }])).toBe('hello-world')
    expect(applyTransforms('hello_world', [{ name: 'camel', args: [] }])).toBe('helloWorld')
    expect(applyTransforms('hello_world', [{ name: 'pascal', args: [] }])).toBe('HelloWorld')
    expect(applyTransforms('  x  ', [{ name: 'trim', args: [] }])).toBe('x')
  })

  it('chains transforms', () => {
    expect(
      applyTransforms('Hello World', [
        { name: 'snake', args: [] },
        { name: 'upper', args: [] },
      ])
    ).toBe('HELLO_WORLD')
  })
})

describe('hasGeneratorOptionFilters', () => {
  it('detects generator options', () => {
    expect(hasGeneratorOptionFilters([{ name: 'female', args: [] }])).toBe(true)
    expect(hasGeneratorOptionFilters([{ name: 'upper', args: [] }])).toBe(false)
  })
})
