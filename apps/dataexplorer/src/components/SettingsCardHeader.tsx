import { cn } from '@4d/ui'
import type { ReactNode } from 'react'
import { isMobileShell } from '~/lib/platform'

export function SettingsCardHeader({ icon, title }: { icon: ReactNode; title: string }) {
  const mobile = isMobileShell()
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center rounded-sm bg-muted text-muted-foreground',
          mobile ? 'h-8 w-8' : 'h-6 w-6'
        )}
        aria-hidden
      >
        {icon}
      </div>
      <h2 className={cn('font-semibold', mobile ? 'text-base' : 'text-sm')}>{title}</h2>
    </div>
  )
}
