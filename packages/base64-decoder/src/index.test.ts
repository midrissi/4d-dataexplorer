import { beforeAll, describe, expect, it } from 'bun:test'
import { decodeBase64ToJsonObject, initBase64Decoder } from './index'
import type { JsonObject, JsonValue } from './json-types'

function stringToUtf16Bytes(value: string) {
  const bytes = new Uint8Array(value.length * 2)
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    bytes[index * 2] = codeUnit & 0xff
    bytes[index * 2 + 1] = (codeUnit >>> 8) & 0xff
  }
  return bytes
}

function numberToInt16LE(value: number) {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setInt16(0, value, true)
  return bytes
}

function numberToInt32LE(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setInt32(0, value, true)
  return bytes
}

function numberToUint32LE(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

function numberToUint64LE(value: number) {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true)
  return bytes
}

function signatureToUInt32(signature: string) {
  if (signature.length !== 4) {
    throw new Error('signature must have 4 chars')
  }
  return (
    ((signature.charCodeAt(0) << 24) |
      (signature.charCodeAt(1) << 16) |
      (signature.charCodeAt(2) << 8) |
      signature.charCodeAt(3)) >>>
    0
  )
}

function concat(...parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64')
}

function asJsonObject(value: JsonValue): JsonObject {
  expect(value).toBeTruthy()
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)
  return value as JsonObject
}

describe('decodeBase64ToJsonObject', () => {
  beforeAll(async () => {
    await initBase64Decoder()
  })

  it('decodes a plain base64 JSON object', () => {
    const json = JSON.stringify({ hello: 'world', count: 2 })
    const payload = Buffer.from(json, 'utf-8').toString('base64')

    const decoded = decodeBase64ToJsonObject(payload)
    expect(decoded).toEqual({ hello: 'world', count: 2 })
  })

  it('decodes __PRIVATE_BINARY_OBJECT payload recursively', () => {
    const payloadBytes = concat(
      new Uint8Array([5]),
      numberToInt16LE(-3),
      numberToUint32LE(signatureToUInt32('jvec')),
      numberToUint64LE(8),
      new Uint8Array(new Float32Array([1.5, 2.5]).buffer)
    )

    const envelope = {
      __PRIVATE_BINARY_OBJECT: toBase64(payloadBytes),
    }

    const encoded = Buffer.from(JSON.stringify(envelope), 'utf-8').toString('base64')
    const decoded = asJsonObject(decodeBase64ToJsonObject(encoded))

    expect(decoded.__class).toBe('jvec')
    expect(decoded.__decoded).toEqual({
      name: '4D.Vector',
      tags: ['32'],
      length: 2,
      elements: [1.5, 2.5],
    })
  })

  it('decodes built-in JFil payloads', () => {
    const path = '/tmp/demo.txt'
    const databaseId = 'Main'

    const filePayload = concat(
      numberToInt32LE(0),
      numberToInt32LE(path.length),
      stringToUtf16Bytes(path),
      numberToInt32LE(databaseId.length),
      stringToUtf16Bytes(databaseId)
    )

    const binary = concat(
      new Uint8Array([5]),
      numberToInt16LE(-3),
      numberToUint32LE(signatureToUInt32('JFil')),
      numberToUint64LE(filePayload.byteLength),
      filePayload
    )

    const decoded = asJsonObject(decodeBase64ToJsonObject(toBase64(binary)))

    expect(decoded.__class).toBe('JFil')
    expect(decoded.__decoded).toEqual({
      name: '4D.File',
      type: 'CLASSIC_FILE',
      path,
      databaseId,
    })
  })

  it('decodes JBlb blob payloads', () => {
    const blobBytes = new Uint8Array([1, 2, 3, 4, 5])
    const binary = concat(
      new Uint8Array([5]),
      numberToInt16LE(-3),
      numberToUint32LE(signatureToUInt32('JBlb')),
      numberToUint64LE(blobBytes.byteLength),
      blobBytes
    )

    const decoded = asJsonObject(decodeBase64ToJsonObject(toBase64(binary)))
    expect(decoded.__class).toBe('JBlb')
    expect(decoded.__decoded).toEqual({
      name: 'Blob',
      size: 5,
      dataBase64: toBase64(blobBytes),
    })
  })

  it('decodes 4ptr pointer payloads', () => {
    const pointerPayload = concat(numberToInt16LE(0), numberToInt16LE(12), numberToInt16LE(3))
    const binary = concat(
      new Uint8Array([5]),
      numberToInt16LE(-3),
      numberToUint32LE(signatureToUInt32('4ptr')),
      numberToUint64LE(pointerPayload.byteLength),
      pointerPayload
    )

    const decoded = asJsonObject(decodeBase64ToJsonObject(toBase64(binary)))
    expect(decoded.__class).toBe('4ptr')
    expect(decoded.__decoded).toEqual({
      name: 'Pointer',
      kindCode: 0,
      kind: 'field',
      fileNo: 12,
      fieldNo: 3,
    })
  })

  it('decodes opaque class payloads with metadata', () => {
    const payload = new Uint8Array([9, 8, 7])
    const binary = concat(
      new Uint8Array([5]),
      numberToInt16LE(-3),
      numberToUint32LE(signatureToUInt32('pict')),
      numberToUint64LE(payload.byteLength),
      payload
    )

    const decoded = asJsonObject(decodeBase64ToJsonObject(toBase64(binary)))
    expect(decoded.__class).toBe('pict')
    expect(decoded.__decoded).toEqual({
      name: 'Picture',
      payloadSize: 3,
      payloadBase64: toBase64(payload),
    })
  })

  it('decodes FHan file-handle payloads', () => {
    const binary = concat(
      new Uint8Array([5]),
      numberToInt16LE(-3),
      numberToUint32LE(signatureToUInt32('FHan')),
      numberToUint64LE(0)
    )

    const decoded = asJsonObject(decodeBase64ToJsonObject(toBase64(binary)))
    expect(decoded.__class).toBe('FHan')
    expect(decoded.__decoded).toEqual({
      name: 'FileHandle',
      notes: 'Runtime file handle; binary payload is currently empty',
      payloadSize: 0,
    })
  })

  it('decodes formula.txt-shaped objects with nested 4fma class', () => {
    const base64 =
      'BQcAZgBvAHIAbQB1AGwAYQAF/f9hbWY0PAAAAAAAAAAAAAAAKAAAAAAACAAAAAAARVZTUk9JDQABAJcABAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAD//w=='

    const decoded = decodeBase64ToJsonObject(base64)

    expect(decoded).toEqual({
      formula: {
        __class: '4fma',
        __decoded: {
          name: 'Formula',
          formulaBase64: 'AAAIAAAAAABFVlNST0kNAAEAlwAEAAUAAAAAAAAAAAAAAAAAAAAAAA==',
        },
      },
    })
  })

  it('decodes array.txt-shaped top-level arrays with nested 4fma', () => {
    const base64 =
      'BgMAAAAEAAAAAAAA8D8EAAAAAAAAAEAF/f9hbWY0PAAAAAAAAAAAAAAAKAAAAAAACAAAAAAARVZTUk9JDQABACkABAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAA='

    const decoded = decodeBase64ToJsonObject(base64)

    expect(decoded).toEqual([
      1,
      2,
      {
        __class: '4fma',
        __decoded: {
          formulaBase64: 'AAAIAAAAAABFVlNST0kNAAEAKQAEAAUAAAAAAAAAAAAAAAAAAAAAAA==',
          name: 'Formula',
        },
      },
    ])
  })

  it('decodes method.txt-shaped VolM payloads with source code', () => {
    const base64 =
      'Bf3/TWxvVmUAAAAAAAAAAgAAADRkAAAAAAAAAABTAAAAI0RFQ0xBUkUoJG51bWJlcjEgOiBJbnRlZ2VyOyAkbnVtYmVyMiA6IEludGVnZXIpIDogSW50ZWdlcg1yZXR1cm4gJG51bWJlcjEqJG51bWJlcjI='

    const decoded = decodeBase64ToJsonObject(base64) as {
      __class: string
      __decoded: {
        name: string
        language: string
        code: string
        methodName: string
        databaseId: string
      }
    }

    expect(decoded.__class).toBe('VolM')
    expect(decoded.__decoded.name).toBe('Method')
    expect(decoded.__decoded.language).toBe('4d')
    expect(decoded.__decoded.code).toContain('#DECLARE')
    expect(decoded.__decoded.code).toContain('return $number1*$number2')
  })
})
