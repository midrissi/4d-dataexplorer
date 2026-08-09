import { Button, Checkbox, cn } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { triState } from '~/lib/rest-export'

export function RestExportSelectableList({
  icon: Icon,
  title,
  listId,
  names,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  emptyTitle,
  emptyDescription,
  counts,
  hint,
}: {
  icon: LucideIcon
  title: string
  listId: string
  names: string[]
  selected: string[]
  onToggle: (name: string, checked: boolean) => void
  onSelectAll: () => void
  onSelectNone: () => void
  emptyTitle: string
  emptyDescription: string
  counts?: Record<string, number>
  hint?: string
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const selectedSet = new Set(selected)
  const state = triState(selected.length, names.length)
  const isEmpty = names.length === 0

  return (
    <div className="min-w-0 flex-1">
      <div
        className={cn(
          'overflow-hidden border-border/70 bg-muted/10 shadow-xs',
          mobile ? 'border-0' : 'rounded-md border'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1',
            mobile && 'px-3 py-1.5'
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <p className={cn('min-w-0 truncate font-medium text-xs', mobile && 'text-sm')}>{title}</p>
          {!isEmpty ? (
            <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
              {selected.length}
              <span className="text-muted-foreground/60">/{names.length}</span>
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'ml-auto h-6 shrink-0 px-2 text-[11px] text-muted-foreground',
              mobile && 'h-9 text-xs'
            )}
            disabled={isEmpty}
            onClick={() => (state === true ? onSelectNone() : onSelectAll())}
          >
            {state === true ? t('restExportBuilder.selectNone') : t('restExportBuilder.selectAll')}
          </Button>
        </div>

        {isEmpty ? (
          <div className="p-2">
            <EmptyPanel
              icon={Icon}
              badgeTone="muted"
              title={emptyTitle}
              description={emptyDescription}
              ghost="rows"
              bordered
              size="sm"
            />
          </div>
        ) : (
          <ul
            className={cn(
              'overflow-y-auto overscroll-contain bg-background/40',
              mobile ? 'max-h-[min(18rem,50vh)]' : 'max-h-56'
            )}
          >
            {names.map((name) => {
              const id = `rest-export-${listId}-${name}`
              const checked = selectedSet.has(name)
              const count = counts?.[name]
              return (
                <li key={name}>
                  <label
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 border-border/50 border-b px-2 py-1 last:border-b-0 hover:bg-muted/35',
                      mobile && 'min-h-11 py-1.5'
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => onToggle(name, value === true)}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 overflow-x-auto font-mono text-[11px] text-foreground/90',
                        mobile && 'text-xs'
                      )}
                    >
                      {name}
                    </span>
                    {count != null ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {count}
                        <span className="sr-only">
                          {t('restExportBuilder.functionCountAria', { count })}
                        </span>
                      </span>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {hint ? <p className="mt-1 px-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
