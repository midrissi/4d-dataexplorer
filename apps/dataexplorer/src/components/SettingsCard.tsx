import { cn } from '@4d/ui'
import type { ReactNode } from 'react'
import { isMobileShell } from '~/lib/platform'

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  const mobile = isMobileShell()
  return (
    <div
      className={cn('rounded-md border border-border bg-card', mobile ? 'p-4' : 'p-3', className)}
    >
      {children}
    </div>
  )
}
