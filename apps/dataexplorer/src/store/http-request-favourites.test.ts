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

  it('updates an existing favourite request', () => {
    const id = useHttpRequestFavouritesStore.getState().addFavourite(seed)
    expect(id).toBeTruthy()
    if (!id) return
    useHttpRequestFavouritesStore.getState().updateFavouriteMeta(id, {
      name: 'Cars list',
      tags: ['api'],
    })
    const next = { ...seed, path: '/rest/Car?$top=10' }
    expect(useHttpRequestFavouritesStore.getState().updateFavourite(id, next)).toBe(true)
    const favourite = useHttpRequestFavouritesStore.getState().favourites[0]
    expect(favourite?.id).toBe(id)
    expect(favourite?.name).toBe('Cars list')
    expect(favourite?.tags).toEqual(['api'])
    expect(favourite?.seed.path).toBe('/rest/Car?$top=10')
    expect(useHttpRequestFavouritesStore.getState().favourites).toHaveLength(1)
  })

  it('duplicates a favourite with a copy name', () => {
    const id = useHttpRequestFavouritesStore.getState().addFavourite(seed, {
      name: 'Cars list',
      tags: ['api'],
    })
    expect(id).toBeTruthy()
    if (!id) return
    const copyId = useHttpRequestFavouritesStore.getState().duplicateFavourite(id)
    expect(copyId).toBeTruthy()
    if (!copyId) return
    expect(copyId).not.toBe(id)
    const favourites = useHttpRequestFavouritesStore.getState().favourites
    expect(favourites).toHaveLength(2)
    expect(favourites[0]?.id).toBe(copyId)
    expect(favourites[0]?.name).toBe('Cars list (copy)')
    expect(favourites[0]?.tags).toEqual(['api'])
    expect(favourites[0]?.seed).toEqual(seed)
    expect(favourites[1]?.id).toBe(id)
  })
})
