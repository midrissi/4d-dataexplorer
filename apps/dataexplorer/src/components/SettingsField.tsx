import { cn } from '@4d/ui'
import type { ReactNode } from 'react'
import { isMobileShell } from '~/lib/platform'

/** Label + optional help text above a settings control. */
export function SettingsField({
  label,
  description,
  children,
  className,
}: {
  label: string
  description?: string
  children: ReactNode
  className?: string
}) {
  const mobile = isMobileShell()

  return (
    <div className={cn('space-y-1.5', mobile && 'space-y-2', className)}>
      <div className="space-y-0.5">
        <span
          className={cn(
            mobile ? 'font-medium text-foreground text-sm' : 'text-muted-foreground text-xs'
          )}
        >
          {label}
        </span>
        {description ? (
          <p className="text-muted-foreground text-xs leading-snug">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}
