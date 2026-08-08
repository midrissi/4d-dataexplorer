import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyFavouriteMeta,
  type FavouriteMeta,
  normalizeFavouriteName,
  normalizeFavouriteTags,
} from './favourite-meta'
import type { HttpClientSeed } from './http-client-types'
import { sameHttpSeed } from './same-http-seed'

export type HttpRequestFavourite = {
  id: string
  createdAt: number
  seed: HttpClientSeed
  name?: string
  tags?: string[]
}

type HttpRequestFavouritesState = {
  favourites: HttpRequestFavourite[]
  isFavourite: (seed: HttpClientSeed) => boolean
  toggleFavourite: (seed: HttpClientSeed) => void
  addFavourite: (seed: HttpClientSeed, meta?: FavouriteMeta) => void
  updateFavouriteMeta: (id: string, meta: FavouriteMeta) => void
  removeFavourite: (id: string) => void
  clearFavourites: () => void
}

const MAX_FAVOURITES = 50

export const useHttpRequestFavouritesStore = create<HttpRequestFavouritesState>()(
  persist(
    (set, get) => ({
      favourites: [],
      isFavourite: (seed) => get().favourites.some((item) => sameHttpSeed(item.seed, seed)),
      addFavourite: (seed, meta) =>
        set((state) => {
          if (state.favourites.some((item) => sameHttpSeed(item.seed, seed))) {
            return state
          }
          const name = normalizeFavouriteName(meta?.name)
          const tags = normalizeFavouriteTags(meta?.tags)
          return {
            favourites: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                createdAt: Date.now(),
                seed,
                ...(name ? { name } : {}),
                ...(tags.length > 0 ? { tags } : {}),
              },
              ...state.favourites,
            ].slice(0, MAX_FAVOURITES),
          }
        }),
      updateFavouriteMeta: (id, meta) =>
        set((state) => ({
          favourites: state.favourites.map((item) =>
            item.id === id ? applyFavouriteMeta(item, meta) : item
          ),
        })),
      removeFavourite: (id) =>
        set((state) => ({
          favourites: state.favourites.filter((item) => item.id !== id),
        })),
      toggleFavourite: (seed) => {
        const existing = get().favourites.find((item) => sameHttpSeed(item.seed, seed))
        if (existing) {
          get().removeFavourite(existing.id)
          return
        }
        get().addFavourite(seed)
      },
      clearFavourites: () => set({ favourites: [] }),
    }),
    { name: 'dataexplorer-http-request-favourites-v1' }
  )
)
