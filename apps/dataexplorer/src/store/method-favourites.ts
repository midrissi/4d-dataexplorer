import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyFavouriteMeta,
  type FavouriteMeta,
  normalizeFavouriteName,
  normalizeFavouriteTags,
} from './favourite-meta'
import type { MethodExecutorSeed } from './method-executor-types'
import { sameMethodConfig } from './same-method-config'

export type MethodFavourite = {
  id: string
  createdAt: number
  config: MethodExecutorSeed
  name?: string
  tags?: string[]
}

type MethodFavouritesState = {
  favourites: MethodFavourite[]
  isFavourite: (config: MethodExecutorSeed) => boolean
  toggleFavourite: (config: MethodExecutorSeed) => void
  addFavourite: (config: MethodExecutorSeed, meta?: FavouriteMeta) => void
  updateFavouriteMeta: (id: string, meta: FavouriteMeta) => void
  removeFavourite: (id: string) => void
  clearFavourites: () => void
}

const MAX_FAVOURITES = 50

export const useMethodFavouritesStore = create<MethodFavouritesState>()(
  persist(
    (set, get) => ({
      favourites: [],
      isFavourite: (config) =>
        get().favourites.some((item) => sameMethodConfig(item.config, config)),
      addFavourite: (config, meta) =>
        set((state) => {
          if (state.favourites.some((item) => sameMethodConfig(item.config, config))) {
            return state
          }
          const name = normalizeFavouriteName(meta?.name)
          const tags = normalizeFavouriteTags(meta?.tags)
          return {
            favourites: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                createdAt: Date.now(),
                config,
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
      toggleFavourite: (config) => {
        const existing = get().favourites.find((item) => sameMethodConfig(item.config, config))
        if (existing) {
          get().removeFavourite(existing.id)
          return
        }
        get().addFavourite(config)
      },
      clearFavourites: () => set({ favourites: [] }),
    }),
    { name: 'dataexplorer-method-favourites-v1' }
  )
)
