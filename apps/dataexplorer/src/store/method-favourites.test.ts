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
})
