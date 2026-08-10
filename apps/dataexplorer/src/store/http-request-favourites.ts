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
  /** Returns the favourite id (existing or newly created). */
  addFavourite: (seed: HttpClientSeed, meta?: FavouriteMeta) => string | null
  /** Replace the saved request for an existing favourite (keeps name/tags). */
  updateFavourite: (id: string, seed: HttpClientSeed) => boolean
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

export const useHttpRequestFavouritesStore = create<HttpRequestFavouritesState>()(
  persist(
    (set, get) => ({
      favourites: [],
      isFavourite: (seed) => get().favourites.some((item) => sameHttpSeed(item.seed, seed)),
      addFavourite: (seed, meta) => {
        const existing = get().favourites.find((item) => sameHttpSeed(item.seed, seed))
        if (existing) return existing.id
        const name = normalizeFavouriteName(meta?.name)
        const tags = normalizeFavouriteTags(meta?.tags)
        const id = createFavouriteId()
        set((state) => ({
          favourites: [
            {
              id,
              createdAt: Date.now(),
              seed,
              ...(name ? { name } : {}),
              ...(tags.length > 0 ? { tags } : {}),
            },
            ...state.favourites,
          ].slice(0, MAX_FAVOURITES),
        }))
        return id
      },
      updateFavourite: (id, seed) => {
        const current = get().favourites.find((item) => item.id === id)
        if (!current) return false
        set((state) => {
          const updated: HttpRequestFavourite = { ...current, seed }
          const rest = state.favourites.filter(
            (item) => item.id !== id && !sameHttpSeed(item.seed, seed)
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
              seed: cloneFavouritePayload(source.seed),
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
