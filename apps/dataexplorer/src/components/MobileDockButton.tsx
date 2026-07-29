import { Button, cn } from '@4d/ui'
import { forwardRef, type ReactNode } from 'react'

/** Labeled icon button for the mobile app footer dock. */
export const MobileDockButton = forwardRef<
  HTMLButtonElement,
  {
    label: string
    pressed?: boolean
    children: ReactNode
    className?: string
  } & Omit<React.ComponentProps<typeof Button>, 'children'>
>(function MobileDockButton({ label, pressed, children, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant={pressed ? 'secondary' : 'ghost'}
      aria-pressed={pressed}
      className={cn(
        'h-auto min-h-12 w-full flex-col gap-0.5 rounded-xl px-1 py-1.5 text-muted-foreground',
        'hover:text-foreground',
        pressed && 'text-foreground',
        className
      )}
      {...props}
    >
      <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
        {children}
      </span>
      <span className="max-w-full truncate font-medium text-[10px] leading-none">{label}</span>
    </Button>
  )
})
