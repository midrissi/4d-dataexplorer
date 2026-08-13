import { cn } from '@4d/ui'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '~/i18n'

/** Collapsible “Advanced” block for Method Executor (wrapper + params/headers). */
export function MethodAdvancedSection({
  open,
  onOpenChange,
  badgeCount = 0,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional count of configured advanced items (shown when collapsed). */
  badgeCount?: number
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-md border border-border/70">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
          'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
        )}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
            !open && '-rotate-90'
          )}
          aria-hidden
        />
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t('methodExecutor.advanced')}
        </span>
        {!open && badgeCount > 0 ? (
          <span className="rounded bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
            {badgeCount}
          </span>
        ) : null}
      </button>
      {open ? <div className="space-y-3 border-border/60 border-t px-3 py-3">{children}</div> : null}
    </div>
  )
}
