import { Button, cn, Tooltip, TooltipContent, TooltipTrigger } from '@4d/ui'
import { Hash, Loader2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from '~/i18n'
import { formatCount } from '~/lib/utils'
import { useDataExplorerStore } from '~/store'

type DataclassCountCellProps = {
  name: string
  count: number | null
  /** Append " entities" after the number when loaded. */
  showEntitiesLabel?: boolean
  className?: string
}

/**
 * Display-only count: number when loaded, spinner while fetching, em dash when unknown.
 * Use {@link DataclassLoadCountAction} in hover toolbars to trigger a fetch.
 */
export function DataclassCountCell({
  name,
  count,
  showEntitiesLabel = false,
  className,
}: DataclassCountCellProps) {
  const { t } = useTranslation()
  const loading = useDataExplorerStore((s) => Boolean(s.countLoadingNames[name]))

  if (loading) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        <span className="sr-only">{t('sidebar.loadingCount')}</span>
      </span>
    )
  }

  if (count === null) {
    return (
      <span className={cn('text-muted-foreground/60 tabular-nums', className)} aria-hidden>
        —
      </span>
    )
  }

  return (
    <span className={cn('tabular-nums', className)}>
      {formatCount(count)}
      {showEntitiesLabel ? ` ${t('entity.entities')}` : null}
    </span>
  )
}

type DataclassLoadCountActionProps = {
  name: string
  count: number | null
  className?: string
}

/**
 * Icon button for hover action bars — only rendered when the count is not loaded yet.
 */
export function DataclassLoadCountAction({
  name,
  count,
  className,
}: DataclassLoadCountActionProps) {
  const { t } = useTranslation()
  const loading = useDataExplorerStore((s) => Boolean(s.countLoadingNames[name]))
  const fetchDataclassCount = useDataExplorerStore((s) => s.fetchDataclassCount)

  if (count !== null && !loading) return null

  const onLoad = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    void fetchDataclassCount(name)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="iconXs"
          className={cn('h-6 w-6', className)}
          onClick={onLoad}
          disabled={loading}
          aria-label={t('sidebar.loadCount')}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Hash className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('sidebar.loadCount')}</TooltipContent>
    </Tooltip>
  )
}
