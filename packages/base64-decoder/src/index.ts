import init, {
  decodeBase64ToJsonObject as wasmDecodeBase64ToJsonObject,
} from '../pkg/base64_decoder.js'
import type { DecodeBase64Options, JsonValue } from './json-types'

export type { DecodeBase64Options, JsonArray, JsonObject, JsonPrimitive, JsonValue } from './json-types'

const wasmUrl = new URL('../pkg/base64_decoder_bg.wasm', import.meta.url)

let ready = false
let initError: Error | null = null
let initPromise: Promise<void> | null = null

/**
 * Initialize the WASM decoder. Safe to call multiple times.
 * Call once at app startup (no top-level await — Safari 14 / Tauri desktop).
 */
export async function initBase64Decoder(): Promise<void> {
  if (ready) return
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await init({ module_or_path: wasmUrl })
        ready = true
      } catch (error) {
        initError = error instanceof Error ? error : new Error(String(error))
        throw initError
      }
    })()
  }
  await initPromise
}

function ensureReady(): void {
  if (ready) return
  if (initError) throw initError
  throw new Error(
    '@4d/base64-decoder: WASM is not ready yet. Await initBase64Decoder() before decoding.'
  )
}

/**
 * Decode a base64 payload into a JSON value (object or array) via the Rust/WASM decoder.
 * Kept name for compatibility; top-level arrays are supported.
 * Requires {@link initBase64Decoder} to have completed.
 */
export function decodeBase64ToJsonObject(
  base64: string,
  options: DecodeBase64Options = {}
): JsonValue {
  ensureReady()
  const json = wasmDecodeBase64ToJsonObject(
    base64,
    options.allowPlainJsonString ?? null,
    options.decodePrivateBinaryObject ?? null
  )
  return JSON.parse(json) as JsonValue
}
