export type MethodResponseMeta = {
  status: number
  statusText: string
  durationMs: number
  headers: Record<string, string>
}

export function methodResponseMetaFromCall(res: {
  status: () => number
  statusText: () => string
  time: () => number
  headers: () => Headers
}): MethodResponseMeta {
  return {
    status: res.status(),
    statusText: res.statusText(),
    durationMs: res.time(),
    headers: Object.fromEntries(res.headers().entries()),
  }
}

export function contentTypeFromHeaders(headers: Record<string, string>): string | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') return value
  }
  return undefined
}

export function headerEntriesFromMeta(
  headers: Record<string, string>
): Array<{ key: string; value: string }> {
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

export function isFailedHttpStatus(status: number): boolean {
  return status >= 400
}
