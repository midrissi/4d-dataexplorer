import { Button } from '@4d/ui'
import { Filter, Globe2, ListTree, Radio, Terminal } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { ConsoleFilter } from '~/store/console'

export function ConsoleEmptyState({
  hasEntries,
  filter,
  onClearFilter,
}: {
  hasEntries: boolean
  filter: ConsoleFilter
  onClearFilter: () => void
}) {
  const { t } = useTranslation()
  const filtered = hasEntries && filter !== 'all'

  return (
    <div className="relative flex h-full min-h-32 items-center justify-center overflow-hidden px-4">
      <div className="relative flex max-w-sm flex-col items-center text-center">
        <div className="relative mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 shadow-sm">
            {filtered ? (
              <Filter className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Terminal className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-background shadow-sm">
            {filtered ? (
              <ListTree className="h-3 w-3 text-amber-500" />
            ) : (
              <Radio className="h-3 w-3 text-cyan-500" />
            )}
          </span>
        </div>

        <p className="font-medium text-sm">
          {filtered ? t('console.noMatchesTitle') : t('console.emptyTitle')}
        </p>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          {filtered
            ? t('console.noMatches', {
                filter: t(`console.filter${filter[0].toUpperCase()}${filter.slice(1)}`),
              })
            : t('console.empty')}
        </p>

        {filtered ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 h-7 gap-1.5 text-xs"
            onClick={onClearFilter}
          >
            <Filter className="h-3 w-3" />
            {t('console.clearFilter')}
          </Button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              <Globe2 className="h-3 w-3 text-cyan-600" />
              {t('console.hintNetwork')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              <ListTree className="h-3 w-3 text-sky-500" />
              {t('console.hintObjects')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
