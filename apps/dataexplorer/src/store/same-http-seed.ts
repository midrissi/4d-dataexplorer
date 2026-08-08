import type { HttpClientSeed } from './http-client-types'

/** Stable equality for HTTP client seeds (history / favourites dedupe). */
export function sameHttpSeed(left: HttpClientSeed, right: HttpClientSeed): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
