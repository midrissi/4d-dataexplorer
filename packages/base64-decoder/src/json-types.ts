export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export type JsonObject = {
  [key: string]: JsonValue
}

export type JsonArray = JsonValue[]

export type DecodeBase64Options = {
  allowPlainJsonString?: boolean
  decodePrivateBinaryObject?: boolean
}
