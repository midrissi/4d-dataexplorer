import { describe, expect, it } from 'bun:test'
import { entityDataclassName } from './entity-dataclass-name'

describe('entityDataclassName', () => {
  it('prefers __DATACLASS', () => {
    expect(entityDataclassName({ __DATACLASS: 'City', __entityModel: 'Town' })).toBe('City')
  })

  it('falls back to __entityModel', () => {
    expect(entityDataclassName({ __entityModel: 'Town' })).toBe('Town')
  })

  it('returns undefined when neither marker is a string', () => {
    expect(entityDataclassName({ __KEY: '1' })).toBeUndefined()
  })
})
