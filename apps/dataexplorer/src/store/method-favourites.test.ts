import { beforeEach, describe, expect, it } from 'bun:test'
import { useMethodFavouritesStore } from './method-favourites'

const config = {
  scope: 'dataclass' as const,
  methodName: 'hello',
  dataClass: 'City',
  arguments: [{ id: '1', kind: 'custom' as const, value: '"world"' }],
}

describe('method favourites', () => {
  beforeEach(() => useMethodFavouritesStore.setState({ favourites: [] }))

  it('adds and deduplicates favourites', () => {
    const store = useMethodFavouritesStore.getState()
    store.addFavourite(config)
    store.addFavourite(config)
    expect(useMethodFavouritesStore.getState().favourites).toHaveLength(1)
    expect(store.isFavourite(config)).toBe(true)
  })

  it('toggles favourites on and off', () => {
    const store = useMethodFavouritesStore.getState()
    store.toggleFavourite(config)
    expect(store.isFavourite(config)).toBe(true)
    store.toggleFavourite(config)
    expect(useMethodFavouritesStore.getState().isFavourite(config)).toBe(false)
  })

  it('removes and clears favourites', () => {
    useMethodFavouritesStore.getState().addFavourite(config)
    const id = useMethodFavouritesStore.getState().favourites[0]?.id
    expect(id).toBeDefined()
    if (id) useMethodFavouritesStore.getState().removeFavourite(id)
    expect(useMethodFavouritesStore.getState().favourites).toEqual([])

    useMethodFavouritesStore.getState().addFavourite(config)
    useMethodFavouritesStore.getState().clearFavourites()
    expect(useMethodFavouritesStore.getState().favourites).toEqual([])
  })

  it('updates name and tags', () => {
    useMethodFavouritesStore.getState().addFavourite(config)
    const id = useMethodFavouritesStore.getState().favourites[0]?.id
    expect(id).toBeDefined()
    if (!id) return
    useMethodFavouritesStore.getState().updateFavouriteMeta(id, {
      name: 'Say hello',
      tags: ['demo', 'demo', 'smoke'],
    })
    const favourite = useMethodFavouritesStore.getState().favourites[0]
    expect(favourite?.name).toBe('Say hello')
    expect(favourite?.tags).toEqual(['demo', 'smoke'])
  })

  it('updates an existing favourite request', () => {
    const id = useMethodFavouritesStore.getState().addFavourite(config)
    expect(id).toBeTruthy()
    if (!id) return
    useMethodFavouritesStore.getState().updateFavouriteMeta(id, {
      name: 'Say hello',
      tags: ['demo'],
    })
    const next = {
      ...config,
      arguments: [{ id: '1', kind: 'custom' as const, value: '"updated"' }],
    }
    expect(useMethodFavouritesStore.getState().updateFavourite(id, next)).toBe(true)
    const favourite = useMethodFavouritesStore.getState().favourites[0]
    expect(favourite?.id).toBe(id)
    expect(favourite?.name).toBe('Say hello')
    expect(favourite?.tags).toEqual(['demo'])
    expect(
      favourite?.config.arguments?.[0]?.kind === 'custom' && favourite.config.arguments[0].value
    ).toBe('"updated"')
    expect(useMethodFavouritesStore.getState().favourites).toHaveLength(1)
  })

  it('duplicates a favourite with a copy name', () => {
    const id = useMethodFavouritesStore.getState().addFavourite(config, {
      name: 'Say hello',
      tags: ['demo'],
    })
    expect(id).toBeTruthy()
    if (!id) return
    const copyId = useMethodFavouritesStore.getState().duplicateFavourite(id)
    expect(copyId).toBeTruthy()
    if (!copyId) return
    expect(copyId).not.toBe(id)
    const favourites = useMethodFavouritesStore.getState().favourites
    expect(favourites).toHaveLength(2)
    expect(favourites[0]?.id).toBe(copyId)
    expect(favourites[0]?.name).toBe('Say hello (copy)')
    expect(favourites[0]?.tags).toEqual(['demo'])
    expect(favourites[0]?.config).toEqual(config)
    expect(favourites[1]?.id).toBe(id)
  })
})
