/**
 * Module-level Monaco provider registry for the ORDA filter language.
 *
 * `@monaco-editor/react` (and React Strict Mode) can remount the editor and
 * re-run `onMount` while previous language providers are still registered.
 * Keeping disposables only in a component ref loses them on HMR / remount and
 * doubles every completion. A single module slot guarantees at most one set.
 */

type Disposable = { dispose: () => void }

let activeProviders: Disposable[] = []

/** Dispose any previously registered ORDA providers, then install `next`. */
export function replaceOrdaProviders(next: Disposable[]): void {
  for (const provider of activeProviders) {
    provider.dispose()
  }
  activeProviders = next
}

/** Dispose all ORDA providers (e.g. QueryBuilder unmount). */
export function clearOrdaProviders(): void {
  replaceOrdaProviders([])
}
