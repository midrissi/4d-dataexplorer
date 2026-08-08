export function entityDataclassName(value: Record<string, unknown>): string | undefined {
  if (typeof value.__DATACLASS === 'string') return value.__DATACLASS
  if (typeof value.__entityModel === 'string') return value.__entityModel
  return undefined
}
