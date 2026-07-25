import type { JsonArray, JsonObject } from '@4d/base64-decoder'

export type DecodedBinaryObject = {
  __class: string
  __decoded: JsonObject
}

export type VectorDecoded = {
  name: string
  tags?: string[]
  length: number
  elements: number[]
}

export type FileOrFolderDecoded = {
  name: string
  type: string
  path: string
  databaseId: string
}

export type BlobDecoded = {
  name: string
  size: number
  dataBase64: string
}

export type MailAttachmentDecoded = {
  name: string
  path: string
  contentDisposition: string
  contentType: string
  contentId: string
  dataSize: number
  dataBase64: string
}

export type PointerDecoded = {
  name: string
  kind: string
  kindCode: number
  fileNo: number
  fieldNo: number
  remainingBytes?: number
}

export type FormulaDecoded = {
  name: string
  formulaBase64: string
}

export type MethodDecoded = {
  name: string
  code: string
  language?: string
  methodName?: string
  databaseId?: string
  remainingBytes?: number
}

/** Opaque / FileHandle-style payloads with optional embedded base64. */
export type OpaqueDecoded = {
  name: string
  notes?: string
  payloadSize?: number
  payloadBase64?: string
}

export function isDecodedBinaryObject(value: unknown): value is DecodedBinaryObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.__class === 'string' && isJsonObject(record.__decoded)
}

export function isVectorDecoded(value: JsonObject): value is JsonObject & VectorDecoded {
  return (
    typeof value.name === 'string' &&
    typeof value.length === 'number' &&
    Array.isArray(value.elements) &&
    value.elements.every((item) => typeof item === 'number')
  )
}

export function isFileOrFolderDecoded(
  value: JsonObject
): value is JsonObject & FileOrFolderDecoded {
  return (
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.path === 'string' &&
    typeof value.databaseId === 'string'
  )
}

export function isBlobDecoded(value: JsonObject): value is JsonObject & BlobDecoded {
  return (
    typeof value.name === 'string' &&
    typeof value.size === 'number' &&
    typeof value.dataBase64 === 'string'
  )
}

export function isMailAttachmentDecoded(
  value: JsonObject
): value is JsonObject & MailAttachmentDecoded {
  return (
    typeof value.name === 'string' &&
    typeof value.path === 'string' &&
    typeof value.contentDisposition === 'string' &&
    typeof value.contentType === 'string' &&
    typeof value.contentId === 'string' &&
    typeof value.dataSize === 'number' &&
    typeof value.dataBase64 === 'string'
  )
}

export function isPointerDecoded(value: JsonObject): value is JsonObject & PointerDecoded {
  return (
    typeof value.name === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.kindCode === 'number' &&
    typeof value.fileNo === 'number' &&
    typeof value.fieldNo === 'number'
  )
}

export function isFormulaDecoded(value: JsonObject): value is JsonObject & FormulaDecoded {
  return typeof value.name === 'string' && typeof value.formulaBase64 === 'string'
}

export function isMethodDecoded(value: JsonObject): value is JsonObject & MethodDecoded {
  return typeof value.name === 'string' && typeof value.code === 'string'
}

export function isOpaqueDecoded(value: JsonObject): value is JsonObject & OpaqueDecoded {
  return typeof value.name === 'string'
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isJsonArray(value: unknown): value is JsonArray {
  return Array.isArray(value)
}
