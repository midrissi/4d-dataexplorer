import { describe, expect, it } from 'bun:test'
import {
  dataClassMemberContext,
  entityMemberContext,
  isDsMemberContext,
  isTerminalModelUri,
  selMemberContext,
} from './orda-js-completion'

describe('isTerminalModelUri', () => {
  it('matches scheme orda-terminal even when path is empty', () => {
    expect(
      isTerminalModelUri({
        scheme: 'orda-terminal',
        path: '',
        toString: () => 'orda-terminal://input.js',
      })
    ).toBe(true)
  })

  it('matches orda-terminal:///input.js path form', () => {
    expect(
      isTerminalModelUri({
        scheme: 'orda-terminal',
        path: '/input.js',
        toString: () => 'orda-terminal:///input.js',
      })
    ).toBe(true)
  })

  it('rejects unrelated models', () => {
    expect(
      isTerminalModelUri({
        scheme: 'inmemory',
        path: '/model/1',
        toString: () => 'inmemory://model/1',
      })
    ).toBe(false)
  })
})

describe('ORDA JS completion contexts', () => {
  it('detects ds. member context', () => {
    expect(isDsMemberContext('ds.')).toBe(true)
    expect(isDsMemberContext('ds.Ca')).toBe(true)
    expect(isDsMemberContext('const x = ds.')).toBe(true)
    expect(isDsMemberContext('ds.Car.')).toBe(false)
  })

  it('detects dataclass member context', () => {
    expect(dataClassMemberContext('ds.Car.')).toEqual({ dataClass: 'Car' })
    expect(dataClassMemberContext('ds.Car.al')).toEqual({ dataClass: 'Car' })
    expect(dataClassMemberContext('ds.Agency.get')).toEqual({ dataClass: 'Agency' })
    expect(dataClassMemberContext('ds.Car.all().')).toBeNull()
  })

  it('detects entity and selection member contexts', () => {
    expect(entityMemberContext('ds.Car.get(12).')).toEqual({ dataClass: 'Car' })
    expect(entityMemberContext('ds.Car.entity(12).sel')).toEqual({ dataClass: 'Car' })
    expect(selMemberContext('ds.Car.sel("abc").')).toEqual({ dataClass: 'Car' })
  })
})
