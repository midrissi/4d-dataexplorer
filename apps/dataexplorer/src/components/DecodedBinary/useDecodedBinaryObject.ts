import type { JsonArray, JsonObject, JsonValue } from '@4d/base64-decoder'
import { decodeBase64ToJsonObject } from '@4d/base64-decoder'
import { useMemo } from 'react'
import { isDecodedBinaryObject, isJsonArray, isJsonObject } from './types'

/** Binary JSON object (5), array (6), or UTF-8 `{` / `[` wrapping a private payload. */
function mightBeDecodable(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false
  const first = bytes[0]
  return first === 5 || first === 6 || first === 0x7b || first === 0x5b
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function isDecodableRoot(value: unknown): value is JsonObject | JsonArray {
  return isJsonObject(value) || isJsonArray(value)
}

/**
 * Decode a private-binary base64 string or raw bytes.
 * Returns a root 4D class, a plain JSON object, or a JSON array that may nest
 * classes (e.g. `[1, 2, { __class: "4fma", … }]`).
 */
export function tryDecodeBinaryObject(
  base64: string | undefined,
  bytes: Uint8Array | null | undefined
): JsonObject | JsonArray | null {
  if (base64) {
    const payload = base64.replace(/\s/g, '')
    if (payload) {
      try {
        const decoded = decodeBase64ToJsonObject(payload)
        if (isDecodableRoot(decoded)) return decoded
      } catch {
        // Not a 4D binary JSON payload.
      }
    }
  }

  if (bytes && bytes.length > 0 && mightBeDecodable(bytes)) {
    try {
      const decoded = decodeBase64ToJsonObject(bytesToBase64(bytes))
      if (isDecodableRoot(decoded)) return decoded
    } catch {
      // Not a 4D binary JSON payload.
    }
  }

  return null
}

/** Prefer a class display name when the root is a single decoded class. */
export function decodedRootLabel(value: JsonValue | null | undefined): string | null {
  if (!value || typeof value !== 'object') return null
  if (isDecodedBinaryObject(value)) {
    return typeof value.__decoded.name === 'string' ? value.__decoded.name : value.__class
  }
  return null
}

export function useDecodedBinaryObject(
  base64: string | undefined,
  bytes: Uint8Array | null | undefined
): JsonObject | JsonArray | null {
  return useMemo(() => tryDecodeBinaryObject(base64, bytes), [base64, bytes])
}
