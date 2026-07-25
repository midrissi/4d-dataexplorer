import { initBase64Decoder } from '@4d/base64-decoder'
import { type ReactNode, use } from 'react'

/** Shared init promise so Suspense / `use()` and eager callers share one load. */
const readyPromise = initBase64Decoder()

/**
 * Suspends until the WASM base64 decoder is ready.
 * Wrap with {@link Suspense} at the app root.
 */
export function Base64DecoderProvider({ children }: { children: ReactNode }) {
  use(readyPromise)
  return children
}
