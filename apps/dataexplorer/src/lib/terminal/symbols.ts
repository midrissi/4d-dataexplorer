/** Internal markers for ORDA terminal wrappers (not enumerable on spread). */
export const ORDA_KIND = Symbol.for('orda.terminal.kind')
export const ORDA_DATACLASS = Symbol.for('orda.terminal.dataClass')

export type OrdaKind = 'entity' | 'entitysel'

export type OrdaTagged = {
  [ORDA_KIND]?: OrdaKind
  [ORDA_DATACLASS]?: string
}

export function getOrdaKind(value: unknown): OrdaKind | undefined {
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return undefined
  return (value as OrdaTagged)[ORDA_KIND]
}

export function getOrdaDataClass(value: unknown): string | undefined {
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return undefined
  return (value as OrdaTagged)[ORDA_DATACLASS]
}
