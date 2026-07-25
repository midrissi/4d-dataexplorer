import { Button } from '@4d/ui'
import { X } from 'lucide-react'
import { useTranslation } from '~/i18n'
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
  return (
    <div className="flex h-8 items-center justify-between border-border/60 border-t bg-muted/30 px-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <span>{t('sidebar.dataclassesCount', { filtered: filteredCount, total: totalCount })}</span>
        {sortOption !== 'none' && (
          <span className="flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
            {t(SORT_LABEL_KEYS[sortOption])}
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              onClick={() => setSortOption('none')}
              className="ml-0.5 h-4! w-4!"
              title={t('sidebar.clearSorting')}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => setSearchQuery('')}
          >
            {t('entity.clearQuery')}
          </Button>
        )}
      </div>
    </div>
  )
}
