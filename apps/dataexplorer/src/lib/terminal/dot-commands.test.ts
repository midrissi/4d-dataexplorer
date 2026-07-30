import { describe, expect, it } from 'bun:test'
import { filterDotCommandSuggestions, isDotCommandContext, parseDotCommand } from './dot-commands'

describe('parseDotCommand', () => {
  it('parses help aliases', () => {
    expect(parseDotCommand('.help')?.name).toBe('help')
    expect(parseDotCommand('.h')?.name).toBe('help')
    expect(parseDotCommand('.?')?.name).toBe('help')
  })

  it('parses commands with args', () => {
    expect(parseDotCommand('.save weekendCars')).toEqual({
      name: 'save',
      raw: 'save',
      arg: 'weekendCars',
    })
    expect(parseDotCommand('.run  myQuery')).toEqual({
      name: 'run',
      raw: 'run',
      arg: 'myQuery',
    })
  })

  it('ignores multi-line and non-dot input', () => {
    expect(parseDotCommand('ds.Car.all()')).toBeNull()
    expect(parseDotCommand('.help\nmore')).toBeNull()
  })

  it('marks unknown commands', () => {
    expect(parseDotCommand('.foo')?.name).toBe('unknown')
  })
})

describe('dot command autocomplete', () => {
  it('detects .command typing context', () => {
    expect(isDotCommandContext('.')).toBe(true)
    expect(isDotCommandContext('.he')).toBe(true)
    expect(isDotCommandContext('.help')).toBe(true)
    expect(isDotCommandContext('.load')).toBe(true)
    expect(isDotCommandContext('.load ')).toBe(false)
    expect(isDotCommandContext('ds.')).toBe(false)
    expect(isDotCommandContext('x.')).toBe(false)
  })

  it('filters suggestions by prefix and aliases', () => {
    expect(filterDotCommandSuggestions('').map((s) => s.command)).toContain('help')
    expect(filterDotCommandSuggestions('he').map((s) => s.command)).toEqual(['help'])
    expect(filterDotCommandSuggestions('cl').map((s) => s.command)).toEqual(['clear', 'classes'])
    expect(filterDotCommandSuggestions('ls').map((s) => s.command)).toEqual(['snippets'])
  })
})
