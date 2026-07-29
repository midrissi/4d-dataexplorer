import { Button, cn } from '@4d/ui'
import { X } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { SORT_LABEL_KEYS, type SortOption } from './types'

type SidebarFooterProps = {
  filteredCount: number
  totalCount: number
  sortOption: SortOption
  setSortOption: (opt: SortOption) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
}

export function SidebarFooter({
  filteredCount,
  totalCount,
  sortOption,
  setSortOption,
  searchQuery,
  setSearchQuery,
}: SidebarFooterProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-border/60 border-t bg-muted/30',
        mobile ? 'min-h-11 px-3 py-2' : 'h-8 px-2'
      )}
    >
      <span
        className={cn('min-w-0 truncate text-muted-foreground', mobile ? 'text-sm' : 'text-xs')}
      >
        {t('sidebar.dataclassesCount', { filtered: filteredCount, total: totalCount })}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {sortOption !== 'none' ? (
          <span
            className={cn(
              'flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary',
              mobile ? 'text-xs' : 'rounded-sm px-1.5 py-0.5 text-xs'
            )}
          >
            {t(SORT_LABEL_KEYS[sortOption])}
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              onClick={() => setSortOption('none')}
              className={cn(mobile ? 'h-6! w-6!' : 'h-4! w-4!')}
              title={t('sidebar.clearSorting')}
            >
              <X className={mobile ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
            </Button>
          </span>
        ) : null}
        {searchQuery ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(mobile ? 'h-9 px-3 text-sm' : 'h-6 px-1.5 text-xs')}
            onClick={() => setSearchQuery('')}
          >
            {t('entity.clearQuery')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
