import type { MethodExecutorSeed } from './method-executor-types'

/** Stable equality for method executor seeds (history / favourites dedupe). */
export function sameMethodConfig(left: MethodExecutorSeed, right: MethodExecutorSeed): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
