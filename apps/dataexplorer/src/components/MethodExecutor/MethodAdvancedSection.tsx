import { cn } from '@4d/ui'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '~/i18n'

/**
 * Favourites-style collapsible block for Method Executor (wrapper + params/headers).
 * Soft panel chrome with icon, title, count pill — header toggles open/closed.
 */
export function MethodAdvancedSection({
  open,
  onOpenChange,
  badgeCount = 0,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional count of configured advanced items (shown in the header pill). */
  badgeCount?: number
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/70 bg-muted/10 shadow-xs transition-shadow duration-200',
        open && 'shadow-sm'
      )}
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 bg-muted/25 px-2.5 py-1.5 text-left transition-colors',
          'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          open && 'border-border/60 border-b'
        )}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 font-medium text-xs">{t('methodExecutor.advanced')}</span>
        {badgeCount > 0 ? (
          <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
            {badgeCount}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            !open && '-rotate-90'
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="fade-in-0 slide-in-from-top-1 animate-in bg-background/40 duration-200">
          {children}
        </div>
      ) : null}
    </div>
  )
}
