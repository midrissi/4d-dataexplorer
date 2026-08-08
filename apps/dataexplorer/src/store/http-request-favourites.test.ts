import { beforeEach, describe, expect, it } from 'bun:test'
import { useHttpRequestFavouritesStore } from './http-request-favourites'

const seed = {
  method: 'GET' as const,
  path: '/rest/Car',
  targetMode: 'current' as const,
}

describe('http request favourites', () => {
  beforeEach(() => useHttpRequestFavouritesStore.setState({ favourites: [] }))

  it('adds and deduplicates favourites', () => {
    const store = useHttpRequestFavouritesStore.getState()
    store.addFavourite(seed)
    store.addFavourite(seed)
    expect(useHttpRequestFavouritesStore.getState().favourites).toHaveLength(1)
    expect(store.isFavourite(seed)).toBe(true)
  })

  it('toggles favourites on and off', () => {
    const store = useHttpRequestFavouritesStore.getState()
    store.toggleFavourite(seed)
    expect(store.isFavourite(seed)).toBe(true)
    store.toggleFavourite(seed)
    expect(useHttpRequestFavouritesStore.getState().isFavourite(seed)).toBe(false)
  })

  it('removes and clears favourites', () => {
    useHttpRequestFavouritesStore.getState().addFavourite(seed)
    const id = useHttpRequestFavouritesStore.getState().favourites[0]?.id
    expect(id).toBeDefined()
    if (id) useHttpRequestFavouritesStore.getState().removeFavourite(id)
    expect(useHttpRequestFavouritesStore.getState().favourites).toEqual([])

    useHttpRequestFavouritesStore.getState().addFavourite(seed)
    useHttpRequestFavouritesStore.getState().clearFavourites()
    expect(useHttpRequestFavouritesStore.getState().favourites).toEqual([])
  })

  it('updates name and tags', () => {
    useHttpRequestFavouritesStore.getState().addFavourite(seed)
    const id = useHttpRequestFavouritesStore.getState().favourites[0]?.id
    expect(id).toBeDefined()
    if (!id) return
    useHttpRequestFavouritesStore.getState().updateFavouriteMeta(id, {
      name: '  Cars list  ',
      tags: ['api', 'API', ' smoke '],
    })
    const favourite = useHttpRequestFavouritesStore.getState().favourites[0]
    expect(favourite?.name).toBe('Cars list')
    expect(favourite?.tags).toEqual(['api', 'smoke'])
  })
})
