import {
  cn,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { mobileFullscreenDialogClass } from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'

export function EntityIoDialogFrame({
  icon: Icon,
  title,
  description,
  badge,
  children,
  footer,
  size = 'md',
}: {
  icon: LucideIcon
  title: string
  description: ReactNode
  badge?: ReactNode
  children: ReactNode
  footer: ReactNode
  size?: 'md' | 'lg'
}) {
  const mobile = isMobileShell()

  return (
    <DialogContent
      className={cn(
        'overflow-hidden border-border/70 bg-background p-0 shadow-xl',
        mobile
          ? mobileFullscreenDialogClass()
          : cn(
              'flex max-h-[min(86vh,48rem)] flex-col gap-0',
              size === 'lg' ? 'max-w-2xl' : 'max-w-xl'
            )
      )}
    >
      <DialogHeader className="shrink-0 border-border/60 border-b bg-muted/25 py-2 pr-11 pl-3 text-left">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border/70 bg-background/80">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <DialogTitle className="text-sm leading-5">{title}</DialogTitle>
              {badge ? (
                <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {badge}
                </span>
              ) : null}
            </div>
            <DialogDescription className="text-[11px] leading-4">{description}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/40 p-2">
        <div className="flex min-h-full flex-col gap-2">{children}</div>
      </div>

      <DialogFooter className="shrink-0 gap-1.5 border-border/60 border-t bg-muted/15 px-3 py-2">
        {footer}
      </DialogFooter>
    </DialogContent>
  )
}
