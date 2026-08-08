export type MethodWebformNotification = {
  message: string
  type?: string
}

export type MethodWebformMeta = {
  privilegeStamp?: number
  notification?: MethodWebformNotification
}

export type DetectedMethodResult =
  | { kind: 'entity'; value: Record<string, unknown>; webform?: MethodWebformMeta }
  | {
      kind: 'entitysel'
      value: Record<string, unknown>
      entities: Record<string, unknown>[]
      entitySetId?: string
      dataClass?: string
      count: number
      webform?: MethodWebformMeta
    }
  | { kind: 'other'; value: unknown; webform?: MethodWebformMeta }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractEntitySetId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const marker = '/$entityset/'
  const markerIndex = value.lastIndexOf(marker)
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length).split(/[/?#]/)[0] : value
}

/** Reads `__WEBFORM.__NOTIFICATION` / `__WEBFORM.__PRIVILEGES.stamp` from a REST body. */
export function extractWebformMeta(response: unknown): MethodWebformMeta | undefined {
  if (!isRecord(response)) return undefined
  const webform = response.__WEBFORM
  if (!isRecord(webform)) return undefined

  const privileges = webform.__PRIVILEGES
  const privilegeStamp =
    isRecord(privileges) && typeof privileges.stamp === 'number' ? privileges.stamp : undefined

  const rawNotification = webform.__NOTIFICATION
  const notification =
    isRecord(rawNotification) && typeof rawNotification.message === 'string'
      ? {
          message: rawNotification.message,
          type: typeof rawNotification.type === 'string' ? rawNotification.type : undefined,
        }
      : undefined

  if (privilegeStamp === undefined && !notification) return undefined
  return { privilegeStamp, notification }
}

function unwrapMethodResult(response: unknown): unknown {
  if (!isRecord(response) || !('result' in response)) return response
  // Thin envelopes: `{ result }` or `{ result, __WEBFORM }`
  const isEnvelope = Object.keys(response).every((key) => key === 'result' || key === '__WEBFORM')
  return isEnvelope ? response.result : response
}

function withWebform(
  detected: DetectedMethodResult,
  webform: MethodWebformMeta | undefined
): DetectedMethodResult {
  return webform ? { ...detected, webform } : detected
}

export function detectMethodResult(response: unknown): DetectedMethodResult {
  const webform = extractWebformMeta(response)
  const value = unwrapMethodResult(response)

  if (isRecord(value) && Array.isArray(value.__ENTITIES)) {
    const entities = value.__ENTITIES.filter(isRecord)
    return withWebform(
      {
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
      },
      webform
    )
  }

  // New / unsaved entities (e.g. getNewBooking) may omit __KEY but still carry
  // dataclass markers. Prefer those over treating the payload as raw JSON.
  if (
    isRecord(value) &&
    ('__KEY' in value ||
      typeof value.__DATACLASS === 'string' ||
      typeof value.__entityModel === 'string')
  ) {
    return withWebform({ kind: 'entity', value }, webform)
  }

  return withWebform({ kind: 'other', value }, webform)
}
