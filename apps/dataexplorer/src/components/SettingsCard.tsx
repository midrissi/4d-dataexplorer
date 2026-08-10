import { cn } from '@4d/ui'
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from 'react'
import { isMobileShell } from '~/lib/platform'

type SettingsCardProps = {
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>

export const SettingsCard = forwardRef<HTMLDivElement, SettingsCardProps>(function SettingsCard(
  { children, className, ...props },
  ref
) {
  const mobile = isMobileShell()
  return (
    <div
      ref={ref}
      className={cn('rounded-md border border-border bg-card', mobile ? 'p-4' : 'p-3', className)}
      {...props}
    >
      {children}
    </div>
  )
})
