function isEnabledFlag(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}

function stripFilterQuotes(filter: string): string {
  const trimmed = filter.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function splitConjunction(expression: string): { op: 'And' | 'Or'; parts: string[] } | null {
  const orParts = expression.split(/\s+OR\s+/i).map((part) => part.trim()).filter(Boolean)
  if (orParts.length > 1) return { op: 'Or', parts: orParts }
  const andParts = expression.split(/\s+AND\s+/i).map((part) => part.trim()).filter(Boolean)
  if (andParts.length > 1) return { op: 'And', parts: andParts }
  return null
}

function planFromFilter(dataclassName: string, filter: string | undefined) {
  const expression = filter ? stripFilterQuotes(filter) : ''
  if (!expression) {
    return { item: `Sequential scan on Table : ${dataclassName}` }
  }
  const split = splitConjunction(expression)
  if (!split) {
    return { item: `${dataclassName} : ${expression}` }
  }
  return {
    [split.op]: split.parts.map((part) => ({ item: `${dataclassName} : ${part}` })),
  }
}

function pathFromFilter(
  dataclassName: string,
  filter: string | undefined,
  recordsFound: number
) {
  const expression = filter ? stripFilterQuotes(filter) : ''
  if (!expression) {
    return {
      steps: [
        {
          description: `Sequential scan on Table : ${dataclassName}`,
          time: 0,
          recordsfounds: recordsFound,
        },
      ],
    }
  }
  const split = splitConjunction(expression)
  if (!split) {
    return {
      steps: [
        {
          description: `${dataclassName} : ${expression}`,
          time: 0,
          recordsfounds: recordsFound,
        },
      ],
    }
  }
  return {
    steps: [
      {
        description: split.op.toUpperCase(),
        time: 0,
        recordsfounds: recordsFound,
        steps: split.parts.map((part) => ({
          description: `${dataclassName} : ${part}`,
          time: 0,
          recordsfounds: recordsFound,
        })),
      },
    ],
  }
}

/** Attach 4D-style `__queryPlan` / `__queryPath` when the matching REST flags are set. */
export function attachQueryExplain<T extends Record<string, unknown>>(
  result: T,
  query: Record<string, unknown>,
  dataclassName: string,
  recordsFound: number,
  filter?: string
): T {
  const wantPlan = isEnabledFlag(query.$queryplan)
  const wantPath = isEnabledFlag(query.$querypath)
  if (!wantPlan && !wantPath) return result

  const next = { ...result } as T & { __queryPlan?: unknown; __queryPath?: unknown }
  if (wantPlan) next.__queryPlan = planFromFilter(dataclassName, filter)
  if (wantPath) next.__queryPath = pathFromFilter(dataclassName, filter, recordsFound)
  return next
}
