import * as React from 'react'
import { cn } from '../lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-7 w-full rounded-sm border border-input bg-background px-2.5 py-1 text-foreground text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-xs placeholder:text-muted-foreground read-only:cursor-default read-only:bg-input read-only:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 read-only:[-webkit-text-fill-color:var(--foreground)]',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
