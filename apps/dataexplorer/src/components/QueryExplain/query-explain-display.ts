import type { QueryExplainAccess } from '~/lib/query-explain/types'

export function queryExplainAccessTone(access: QueryExplainAccess): { text: string; bg: string } {
  switch (access) {
    case 'join':
      return {
        text: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/25',
      }
    case 'index':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      }
    case 'sequential':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/25',
      }
    case 'filter':
      return {
        text: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/25',
      }
    default:
      return {
        text: 'text-muted-foreground',
        bg: 'bg-muted/60 border-border/70',
      }
  }
}

export function queryExplainAccentClass(access: QueryExplainAccess): string {
  if (access === 'join') return 'bg-sky-500'
  if (access === 'index') return 'bg-emerald-500'
  if (access === 'sequential') return 'bg-amber-500'
  if (access === 'filter') return 'bg-violet-500'
  return 'bg-muted-foreground/40'
}

/** Vertical connector for nested steps — parent access color, low opacity. */
export function queryExplainRailClass(access: QueryExplainAccess): string {
  if (access === 'join') return 'border-sky-500/35'
  if (access === 'index') return 'border-emerald-500/35'
  if (access === 'sequential') return 'border-amber-500/35'
  if (access === 'filter') return 'border-violet-500/35'
  return 'border-border/60'
}

export function queryExplainAccessBadgeClass(access: QueryExplainAccess): string {
  const tone = queryExplainAccessTone(access)
  return `${tone.bg} ${tone.text}`
}
