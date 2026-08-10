import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyFavouriteMeta,
  cloneFavouritePayload,
  type FavouriteMeta,
  nextFavouriteCopyName,
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
  /** Returns the favourite id (existing or newly created). */
  addFavourite: (config: MethodExecutorSeed, meta?: FavouriteMeta) => string | null
  /** Replace the saved request for an existing favourite (keeps name/tags). */
  updateFavourite: (id: string, config: MethodExecutorSeed) => boolean
  /** Copy an existing favourite (new id; allows identical request payloads). */
  duplicateFavourite: (id: string) => string | null
  updateFavouriteMeta: (id: string, meta: FavouriteMeta) => void
  removeFavourite: (id: string) => void
  clearFavourites: () => void
}

const MAX_FAVOURITES = 50

function createFavouriteId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useMethodFavouritesStore = create<MethodFavouritesState>()(
  persist(
    (set, get) => ({
      favourites: [],
      isFavourite: (config) =>
        get().favourites.some((item) => sameMethodConfig(item.config, config)),
      addFavourite: (config, meta) => {
        const existing = get().favourites.find((item) => sameMethodConfig(item.config, config))
        if (existing) return existing.id
        const name = normalizeFavouriteName(meta?.name)
        const tags = normalizeFavouriteTags(meta?.tags)
        const id = createFavouriteId()
        set((state) => ({
          favourites: [
            {
              id,
              createdAt: Date.now(),
              config,
              ...(name ? { name } : {}),
              ...(tags.length > 0 ? { tags } : {}),
            },
            ...state.favourites,
          ].slice(0, MAX_FAVOURITES),
        }))
        return id
      },
      updateFavourite: (id, config) => {
        const current = get().favourites.find((item) => item.id === id)
        if (!current) return false
        set((state) => {
          const updated: MethodFavourite = { ...current, config }
          const rest = state.favourites.filter(
            (item) => item.id !== id && !sameMethodConfig(item.config, config)
          )
          return { favourites: [updated, ...rest].slice(0, MAX_FAVOURITES) }
        })
        return true
      },
      duplicateFavourite: (id) => {
        const source = get().favourites.find((item) => item.id === id)
        if (!source) return null
        if (get().favourites.length >= MAX_FAVOURITES) return null
        const name = nextFavouriteCopyName(
          source.name,
          get().favourites.map((item) => item.name)
        )
        const tags = source.tags?.length ? [...source.tags] : undefined
        const newId = createFavouriteId()
        set((state) => ({
          favourites: [
            {
              id: newId,
              createdAt: Date.now(),
              config: cloneFavouritePayload(source.config),
              ...(name ? { name } : {}),
              ...(tags ? { tags } : {}),
            },
            ...state.favourites,
          ].slice(0, MAX_FAVOURITES),
        }))
        return newId
      },
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
