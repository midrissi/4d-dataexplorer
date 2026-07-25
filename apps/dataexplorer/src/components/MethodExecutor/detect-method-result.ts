export type DetectedMethodResult =
  | { kind: 'entity'; value: Record<string, unknown> }
  | {
      kind: 'entitysel'
      value: Record<string, unknown>
      entities: Record<string, unknown>[]
      entitySetId?: string
      dataClass?: string
      count: number
    }
  | { kind: 'other'; value: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractEntitySetId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const marker = '/$entityset/'
  const markerIndex = value.lastIndexOf(marker)
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length).split(/[/?#]/)[0] : value
}

export function detectMethodResult(response: unknown): DetectedMethodResult {
  const value =
    isRecord(response) && 'result' in response && Object.keys(response).length <= 2
      ? response.result
      : response

  if (isRecord(value) && Array.isArray(value.__ENTITIES)) {
    const entities = value.__ENTITIES.filter(isRecord)
    return {
      kind: 'entitysel',
      value,
      entities,
      entitySetId: extractEntitySetId(value.__ENTITYSET),
      dataClass:
        typeof value.__entityModel === 'string'
          ? value.__entityModel
          : typeof entities[0]?.__DATACLASS === 'string'
            ? entities[0].__DATACLASS
            : undefined,
      count: typeof value.__COUNT === 'number' ? value.__COUNT : entities.length,
    }
  }

  // New / unsaved entities (e.g. getNewBooking) may omit __KEY but still carry
  // dataclass markers. Prefer those over treating the payload as raw JSON.
  if (
    isRecord(value) &&
    ('__KEY' in value ||
      typeof value.__DATACLASS === 'string' ||
      typeof value.__entityModel === 'string')
  ) {
    return { kind: 'entity', value }
  }

  return { kind: 'other', value }
}
