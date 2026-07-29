export type ServerUrlSuggestionKind = 'recent' | 'preset' | 'complete'

export type ServerUrlSuggestion = {
  id: string
  url: string
  kind: ServerUrlSuggestionKind
  /** Short host:port style label for the row title. */
  title: string
  /** Optional secondary hint (scheme / origin of the tip). */
  subtitle?: string
}

export const SERVER_URL_PRESETS = ['http://localhost:7080', 'https://localhost:7443'] as const

export const SERVER_URL_PORTS = ['7080', '7443', '8080'] as const

const HOST_LIKE =
  /^(?:localhost|(?:\d{1,3}\.){0,3}\d{0,3}|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)$/i

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, '')
}

function displayHost(url: string): string {
  return stripScheme(url).replace(/\/$/, '') || url
}

function hasScheme(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function parseLoose(value: string): { scheme: string; rest: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const m = trimmed.match(/^(https?):\/\/(.+)$/i)
  if (m) return { scheme: m[1].toLowerCase(), rest: m[2] }
  return { scheme: '', rest: trimmed }
}

/** Swap or set http/https on the current draft. */
export function applyServerUrlScheme(value: string, scheme: 'http' | 'https'): string {
  const trimmed = value.trim()
  if (!trimmed) return `${scheme}://localhost:7080`
  if (hasScheme(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, `${scheme}://`)
  }
  return `${scheme}://${stripScheme(trimmed)}`
}

/** Set or replace the port on the current draft (adds http:// if needed). */
export function applyServerUrlPort(value: string, port: string): string {
  const trimmed = value.trim()
  if (!trimmed) return `http://localhost:${port}`

  const parsed = parseLoose(trimmed)
  if (!parsed) return `http://localhost:${port}`

  const scheme = parsed.scheme || 'http'
  let hostPort = parsed.rest.replace(/\/$/, '')
  // Strip path/query for builder chips — keep host:port focus.
  hostPort = hostPort.split(/[/?#]/)[0] ?? hostPort

  if (!hostPort) return `${scheme}://localhost:${port}`

  if (hostPort.includes(':')) {
    hostPort = hostPort.replace(/:\d+$/, `:${port}`)
  } else {
    hostPort = `${hostPort}:${port}`
  }
  return `${scheme}://${hostPort}`
}

function pushUnique(
  out: ServerUrlSuggestion[],
  seen: Set<string>,
  item: Omit<ServerUrlSuggestion, 'id'> & { id?: string }
): void {
  const key = item.url.replace(/\/$/, '').toLowerCase()
  if (!key || seen.has(key)) return
  seen.add(key)
  out.push({
    id: item.id ?? key,
    url: item.url.replace(/\/$/, ''),
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
  })
}

/**
 * Build ranked URL suggestions for the mobile connection form.
 * Combines saved servers, localhost presets, and smart completions.
 */
export function buildServerUrlSuggestions(
  input: string,
  recentUrls: string[] = []
): ServerUrlSuggestion[] {
  const q = input.trim()
  const qLower = q.toLowerCase()
  const qHost = stripScheme(q).toLowerCase()
  const out: ServerUrlSuggestion[] = []
  const seen = new Set<string>()

  for (const raw of recentUrls) {
    const url = raw.trim().replace(/\/$/, '')
    if (!url) continue
    if (
      q &&
      !url.toLowerCase().includes(qLower) &&
      !stripScheme(url).toLowerCase().includes(qHost)
    ) {
      continue
    }
    pushUnique(out, seen, {
      url,
      kind: 'recent',
      title: displayHost(url),
      subtitle: hasScheme(url) ? url.match(/^https?:/i)?.[0]?.toLowerCase() : undefined,
    })
    if (out.filter((s) => s.kind === 'recent').length >= 5) break
  }

  for (const url of SERVER_URL_PRESETS) {
    if (
      q &&
      !url.toLowerCase().includes(qLower) &&
      !stripScheme(url).toLowerCase().includes(qHost)
    ) {
      continue
    }
    pushUnique(out, seen, {
      url,
      kind: 'preset',
      title: displayHost(url),
      subtitle: url.startsWith('https') ? 'https' : 'http',
    })
  }

  if (!q) return out.slice(0, 8)

  const parsed = parseLoose(q)
  if (!parsed) return out.slice(0, 8)

  // Bare host / partial IP → complete with common 4D ports.
  if (!parsed.scheme && HOST_LIKE.test(parsed.rest) && !parsed.rest.includes(':')) {
    const host = parsed.rest
    for (const port of SERVER_URL_PORTS) {
      pushUnique(out, seen, {
        url: `http://${host}:${port}`,
        kind: 'complete',
        title: `${host}:${port}`,
        subtitle: 'http',
      })
      pushUnique(out, seen, {
        url: `https://${host}:${port}`,
        kind: 'complete',
        title: `${host}:${port}`,
        subtitle: 'https',
      })
    }
  }

  // Scheme + host without port → append common ports.
  if (parsed.scheme && parsed.rest && !parsed.rest.includes(':') && !/[/?#]/.test(parsed.rest)) {
    const host = parsed.rest
    for (const port of SERVER_URL_PORTS) {
      pushUnique(out, seen, {
        url: `${parsed.scheme}://${host}:${port}`,
        kind: 'complete',
        title: `${host}:${port}`,
        subtitle: parsed.scheme,
      })
    }
  }

  // Host:port without scheme → add http/https.
  if (!parsed.scheme && /^[^/\s]+:\d+$/.test(parsed.rest)) {
    pushUnique(out, seen, {
      url: `http://${parsed.rest}`,
      kind: 'complete',
      title: parsed.rest,
      subtitle: 'http',
    })
    pushUnique(out, seen, {
      url: `https://${parsed.rest}`,
      kind: 'complete',
      title: parsed.rest,
      subtitle: 'https',
    })
  }

  return out.slice(0, 10)
}
