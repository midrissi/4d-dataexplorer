import { Button, cn } from '@4d/ui'
import { Pencil, Star, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { isMobileShell } from '~/lib/platform'

/**
 * Shared row chrome for History / Favourites lists:
 * optional accent bar, badge, primary content, meta; actions overlay on hover (desktop).
 */
export function SavedListRow({
  accentClassName,
  badge,
  primary,
  primaryTitle,
  primaryClassName,
  meta,
  favourite,
  onEdit,
  editLabel,
  onRemove,
  removeLabel,
  removeMode = 'trash',
  onOpen,
}: {
  accentClassName?: string
  badge?: ReactNode
  primary: ReactNode
  primaryTitle?: string
  primaryClassName?: string
  meta?: ReactNode
  favourite?: {
    active: boolean
    onToggle: () => void
    addLabel: string
    removeLabel: string
  }
  onEdit?: () => void
  editLabel?: string
  onRemove?: () => void
  removeLabel?: string
  /** Favourites lists use a filled star; history uses trash. */
  removeMode?: 'trash' | 'star'
  onOpen: () => void
}) {
  const mobile = isMobileShell()
  const hasActions = Boolean(onEdit || favourite || onRemove)

  const actionBtn = mobile ? 'h-9 w-9' : 'h-5 w-5'
  const actionIcon = mobile ? 'h-3.5 w-3.5' : 'h-3 w-3'

  const actions = (
    <>
      {onEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn('text-muted-foreground hover:text-foreground', actionBtn)}
          onClick={(event) => {
            event.stopPropagation()
            onEdit()
          }}
          aria-label={editLabel}
          title={editLabel}
        >
          <Pencil className={actionIcon} />
        </Button>
      ) : null}

      {favourite ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            favourite.active
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-muted-foreground hover:text-foreground',
            actionBtn
          )}
          onClick={(event) => {
            event.stopPropagation()
            favourite.onToggle()
          }}
          aria-label={favourite.active ? favourite.removeLabel : favourite.addLabel}
          title={favourite.active ? favourite.removeLabel : favourite.addLabel}
          aria-pressed={favourite.active}
        >
          <Star className={cn(actionIcon, favourite.active && 'fill-current')} />
        </Button>
      ) : null}

      {onRemove ? (
        removeMode === 'star' ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn('text-amber-500 hover:text-destructive', actionBtn)}
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            aria-label={removeLabel}
            title={removeLabel}
          >
            <Star className={cn(actionIcon, 'fill-current')} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn('text-muted-foreground hover:text-destructive', actionBtn)}
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            aria-label={removeLabel}
            title={removeLabel}
          >
            <Trash2 className={actionIcon} />
          </Button>
        )
      ) : null}
    </>
  )

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 border-border/50 border-b px-2 py-1 last:border-b-0 hover:bg-muted/35',
        mobile && 'py-1.5'
      )}
    >
      {accentClassName ? (
        <span
          aria-hidden
          className={cn('absolute top-1 bottom-1 left-0 w-0.5 rounded-full', accentClassName)}
        />
      ) : null}

      <button
        type="button"
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left',
          accentClassName ? 'pl-1.5' : 'pl-0.5',
          mobile && 'min-h-11'
        )}
        onClick={onOpen}
        title={primaryTitle}
      >
        {badge}
        <span
          className={cn(
            'min-w-0 flex-1 overflow-x-auto font-mono text-[11px] text-foreground/90',
            mobile && 'text-xs',
            primaryClassName
          )}
        >
          {primary}
        </span>
      </button>

      {meta ? <span className="flex shrink-0 items-center gap-1">{meta}</span> : null}

      {hasActions && mobile ? (
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      ) : null}

      {hasActions && !mobile ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-1 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="flex items-center gap-px rounded-sm bg-muted/95 p-px shadow-sm ring-1 ring-border/50">
            {actions}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Compact pill badge used for HTTP methods / method scopes. */
export function SavedListBadge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-8 shrink-0 items-center justify-center rounded border px-1 font-semibold text-[9px] uppercase tracking-wide',
        className
      )}
    >
      {children}
    </span>
  )
}

/** Status / error pill in list meta. */
export function SavedListMetaPill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn('rounded border px-1 py-px font-medium text-[9px] tabular-nums', className)}
    >
      {children}
    </span>
  )
}
