import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import {
  type DetectedMethodResult,
  detectMethodResult,
  extractEntitySetId,
} from '~/components/MethodExecutor/detect-method-result'
import { getImageUri } from '~/lib/fieldPaths'
import { getOrdaDataClass, getOrdaKind } from './symbols'

export type FormattedTerminalResult =
  | {
      kind: 'entity'
      label: string
      dataClass: string | null
      entityKey: string | null
      /** Slim stub — full entity payload is not kept in scrollback. */
      value: Record<string, unknown>
    }
  | {
      kind: 'entitysel'
      label: string
      dataClass: string | null
      entitySetId: string | undefined
      count: number
      /** Always empty in scrollback — open in a tab for rows. */
      entities: Record<string, unknown>[]
      value: Record<string, unknown>
    }
  | {
      kind: 'binary'
      label: string
      value: unknown
    }
  | {
      kind: 'image'
      label: string
      value: unknown
    }
  | {
      kind: 'other'
      label: string
      value: unknown
    }
  | {
      kind: 'error'
      label: string
      message: string
      value: unknown
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatPrimitiveLabel(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'function') return '[Function]'
  if (typeof value === 'symbol') return value.toString()
  return Object.prototype.toString.call(value)
}

function entityLabel(dataClass: string | null, key: string | null): string {
  const dc = dataClass?.trim() || 'Entity'
  if (key != null && key !== '') return `ds.${dc}.entity(${key})`
  return `ds.${dc}.entity(?)`
}

function selectionLabel(
  dataClass: string | null,
  entitySetId: string | undefined,
  count: number
): string {
  const dc = dataClass?.trim() || 'Entity'
  if (entitySetId) return `ds.${dc}.sel(${entitySetId})`
  return `ds.${dc}.sel(…) · ${count}`
}

function slimEntityValue(
  dataClass: string | null,
  entityKey: string | null
): Record<string, unknown> {
  const value: Record<string, unknown> = {}
  if (dataClass) value.__DATACLASS = dataClass
  if (entityKey != null) value.__KEY = entityKey
  return value
}

function slimSelectionValue(
  dataClass: string | null,
  entitySetId: string | undefined,
  count: number
): Record<string, unknown> {
  const value: Record<string, unknown> = {
    __COUNT: count,
    __ENTITIES: [],
  }
  if (dataClass) value.__entityModel = dataClass
  if (entitySetId) value.__ENTITYSET = `/$entityset/${entitySetId}`
  return value
}

function fromDetected(detected: DetectedMethodResult): FormattedTerminalResult {
  if (detected.kind === 'entity') {
    const dataClass =
      typeof detected.value.__DATACLASS === 'string'
        ? detected.value.__DATACLASS
        : typeof detected.value.__entityModel === 'string'
          ? detected.value.__entityModel
          : null
    const entityKey =
      detected.value.__KEY != null && detected.value.__KEY !== ''
        ? String(detected.value.__KEY)
        : null
    return {
      kind: 'entity',
      label: entityLabel(dataClass, entityKey),
      dataClass,
      entityKey,
      value: slimEntityValue(dataClass, entityKey),
    }
  }

  if (detected.kind === 'entitysel') {
    return {
      kind: 'entitysel',
      label: selectionLabel(detected.dataClass ?? null, detected.entitySetId, detected.count),
      dataClass: detected.dataClass ?? null,
      entitySetId: detected.entitySetId,
      count: detected.count,
      entities: [],
      value: slimSelectionValue(detected.dataClass ?? null, detected.entitySetId, detected.count),
    }
  }

  if (isPrivateBinaryObject(detected.value)) {
    return { kind: 'binary', label: '__PRIVATE_BINARY_OBJECT', value: detected.value }
  }

  if (getImageUri(detected.value)) {
    return { kind: 'image', label: 'image', value: detected.value }
  }

  return {
    kind: 'other',
    label: formatPrimitiveLabel(detected.value),
    value: detected.value,
  }
}

/**
 * Turn a snippet / console.log value into a compact, actionable terminal cell model.
 */
export function formatTerminalResult(value: unknown): FormattedTerminalResult {
  if (value instanceof Error) {
    return {
      kind: 'error',
      label: 'Error',
      message: value.message || String(value),
      value,
    }
  }

  const taggedKind = getOrdaKind(value)
  const taggedDc = getOrdaDataClass(value) ?? null

  if (taggedKind === 'entity' && isRecord(value)) {
    const entityKey = value.__KEY != null && value.__KEY !== '' ? String(value.__KEY) : null
    const dataClass =
      taggedDc ||
      (typeof value.__DATACLASS === 'string' ? value.__DATACLASS : null) ||
      (typeof value.__entityModel === 'string' ? value.__entityModel : null)
    return {
      kind: 'entity',
      label: entityLabel(dataClass, entityKey),
      dataClass,
      entityKey,
      value: slimEntityValue(dataClass, entityKey),
    }
  }

  if (taggedKind === 'entitysel' && isRecord(value) && Array.isArray(value.__ENTITIES)) {
    const entities = value.__ENTITIES.filter(isRecord)
    const entitySetId = extractEntitySetId(value.__ENTITYSET)
    const dataClass =
      taggedDc ||
      (typeof value.__entityModel === 'string' ? value.__entityModel : null) ||
      (typeof entities[0]?.__DATACLASS === 'string' ? entities[0].__DATACLASS : null)
    const count = typeof value.__COUNT === 'number' ? value.__COUNT : entities.length
    return {
      kind: 'entitysel',
      label: selectionLabel(dataClass, entitySetId, count),
      dataClass,
      entitySetId,
      count,
      entities: [],
      value: slimSelectionValue(dataClass, entitySetId, count),
    }
  }

  if (isPrivateBinaryObject(value)) {
    return { kind: 'binary', label: '__PRIVATE_BINARY_OBJECT', value }
  }

  if (getImageUri(value)) {
    return { kind: 'image', label: 'image', value }
  }

  // Primitives / arrays / plain objects — avoid false entity detection on empty objects.
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'other', label: formatPrimitiveLabel(value), value }
  }

  return fromDetected(detectMethodResult(value))
}
