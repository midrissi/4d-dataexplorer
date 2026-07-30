import { describe, expect, it } from 'bun:test'
import { wrapEntity, wrapSelection } from './create-ds'
import { getOrdaKind } from './symbols'

describe('wrapEntity / wrapSelection', () => {
  it('tags entities and exposes getKey', () => {
    const entity = wrapEntity({ __KEY: '12', __STAMP: 1, __DATACLASS: 'Car', name: 'A' }, 'Car')
    expect(getOrdaKind(entity)).toBe('entity')
    expect(entity.getKey()).toBe('12')
    expect(entity.name).toBe('A')
  })

  it('tags selections and exposes getKey / getCount', () => {
    const sel = wrapSelection(
      {
        __entityModel: 'Car',
        __COUNT: 2,
        __SENT: 2,
        __FIRST: 0,
        __ENTITIES: [],
        __ENTITYSET: '/rest/Car/$entityset/abc-id',
      },
      'Car'
    )
    expect(getOrdaKind(sel)).toBe('entitysel')
    expect(sel.getKey()).toBe('abc-id')
    expect(sel.getCount()).toBe(2)
  })
})
