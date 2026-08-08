import { cn } from '@4d/ui'
import type { MethodScope } from '~/store/method-executor-types'
import type { MethodResultKind } from '~/store/method-run-history'

export function methodScopeTone(scope: MethodScope): { text: string; bg: string } {
  switch (scope) {
    case 'catalog':
      return {
        text: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/25',
      }
    case 'dataclass':
      return {
        text: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/25',
      }
    case 'entity':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      }
    case 'entitySelection':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/25',
      }
    default:
      return {
        text: 'text-muted-foreground',
        bg: 'bg-muted/60 border-border/70',
      }
  }
}

export function methodResultAccentClass(resultKind?: MethodResultKind): string {
  if (resultKind === 'entity') return 'bg-emerald-500'
  if (resultKind === 'entitysel') return 'bg-sky-500'
  return 'bg-muted-foreground/40'
}

/** Short badge text for list rows (fits like HTTP method pills). */
export function methodScopeShortLabel(scope: MethodScope): string {
  if (scope === 'catalog') return 'ds'
  if (scope === 'dataclass') return 'class'
  if (scope === 'entity') return 'entity'
  return 'sel'
}

export function methodArgCountMeta(
  argCount: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string | null {
  if (argCount <= 0) return null
  if (argCount === 1) return t('methodExecutor.argumentCountOne')
  return t('methodExecutor.argumentCount', { count: argCount })
}

export function cnMethodScopeBadge(scope: MethodScope): string {
  const tone = methodScopeTone(scope)
  return cn(tone.bg, tone.text)
}
