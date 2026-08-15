import { cn } from '@4d/ui'
import { SavedListBadge } from '~/components/SavedListPanel'
import { useTranslation } from '~/i18n'
import type { QueryExplainAccess } from '~/lib/query-explain/types'
import { queryExplainAccessBadgeClass } from './query-explain-display'

const ACCESS_KEY: Record<Exclude<QueryExplainAccess, 'unknown' | 'operator'>, string> = {
  index: 'queryExplain.accessIndex',
  sequential: 'queryExplain.accessSequential',
  join: 'queryExplain.accessJoin',
  filter: 'queryExplain.accessFilter',
}

export function QueryExplainAccessBadge({
  access,
  label,
}: {
  access: QueryExplainAccess
  label?: string
}) {
  const { t } = useTranslation()
  if (access === 'unknown') return null
  const text = access === 'operator' ? (label ?? '') : t(ACCESS_KEY[access])
  if (!text) return null
  return (
    <SavedListBadge className={cn(queryExplainAccessBadgeClass(access))}>{text}</SavedListBadge>
  )
}
