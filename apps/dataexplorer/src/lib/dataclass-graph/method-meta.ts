import type { MethodScope } from '~/store/method-executor-types'

export function getMethodParamsText(method: Record<string, unknown>): string | null {
  return method.paramsText != null && String(method.paramsText).trim() !== ''
    ? String(method.paramsText).trim()
    : null
}

export function getMethodReactKey(
  method: { name: string; applyTo?: string },
  index: number,
  paramsText: string | null
): string {
  return `${method.name}-${method.applyTo ?? 'none'}-${paramsText ?? '()'}-${index}`
}

export function methodScope(applyTo?: string): MethodScope {
  if (applyTo === 'entity') return 'entity'
  if (
    applyTo === 'entitySelection' ||
    applyTo === 'entityCollection' ||
    applyTo === 'dataClassSelection'
  ) {
    return 'entitySelection'
  }
  return 'dataclass'
}
