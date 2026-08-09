import { Badge, Checkbox, cn, ScrollArea } from '@4d/ui'
import { FavouritePrimaryLabel, SavedListBadge } from '~/components/SavedListPanel'
import { TagList } from '~/components/Tags'
import { useTranslation } from '~/i18n'

export type PostmanExportSelectableItem = {
  id: string
  /** Custom favourite name only (undefined → show signature/path as primary). */
  displayName?: string
  detail: string
  badgeLabel?: string
  badgeClassName?: string
  tags?: string[]
  signatureLabel: string
}

export function PostmanExportItemList({
  items,
  selectedIds,
  onSelectedIdsChange,
}: {
  items: PostmanExportSelectableItem[]
  selectedIds: Set<string>
  onSelectedIdsChange: (next: Set<string>) => void
}) {
  const { t } = useTranslation()
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id))
  const someSelected = items.some((item) => selectedIds.has(item.id))

  const toggleAll = (checked: boolean) => {
    if (checked) {
      onSelectedIdsChange(new Set(items.map((item) => item.id)))
      return
    }
    onSelectedIdsChange(new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    onSelectedIdsChange(next)
  }

  return (
    <div className="overflow-hidden rounded-md bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-border/50 border-b px-1.5 py-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Checkbox
            id="postman-export-select-all"
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(value) => toggleAll(value === true)}
          />
          <label
            htmlFor="postman-export-select-all"
            className="cursor-pointer truncate font-medium text-xs"
          >
            {t('postmanExport.selectAll')}
          </label>
        </div>
        <Badge
          variant="secondary"
          className="h-4 shrink-0 border-0 px-1 font-mono text-[9px] tabular-nums"
        >
          {t('postmanExport.selectedCount', { count: selectedIds.size })}
        </Badge>
      </div>

      <ScrollArea className="max-h-[min(18rem,100%)]">
        <ul className="m-0 list-none">
          {items.map((item) => {
            const selected = selectedIds.has(item.id)
            const tags = item.tags?.filter(Boolean) ?? []
            const title = item.displayName ? `${item.displayName} — ${item.detail}` : item.detail
            return (
              <li key={item.id} className="min-w-0">
                <label
                  htmlFor={`postman-export-item-${item.id}`}
                  title={title}
                  className={cn(
                    'group relative flex cursor-pointer items-center gap-1.5 border-border/50 border-b px-1.5 py-0.5 last:border-b-0',
                    selected ? 'bg-primary/10' : 'hover:bg-muted/35'
                  )}
                >
                  <Checkbox
                    id={`postman-export-item-${item.id}`}
                    className="shrink-0"
                    checked={selected}
                    onCheckedChange={(value) => toggleOne(item.id, value === true)}
                  />
                  {item.badgeLabel ? (
                    <SavedListBadge className={item.badgeClassName}>
                      {item.badgeLabel}
                    </SavedListBadge>
                  ) : null}
                  <span
                    className={cn(
                      'min-w-0 flex-1 overflow-x-auto font-mono text-[11px] text-foreground/90',
                      item.displayName && 'overflow-hidden'
                    )}
                  >
                    <FavouritePrimaryLabel
                      name={item.displayName}
                      detail={item.detail}
                      signatureLabel={item.signatureLabel}
                    />
                  </span>
                  {tags.length > 0 ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <TagList tags={tags} max={2} />
                    </span>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
