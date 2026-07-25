import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../lib/utils'

const alertVariants = cva(
  'relative w-full rounded-md border px-3 py-2 text-sm [&>svg+div]:-translate-y-px [&>svg]:absolute [&>svg]:top-2.5 [&>svg]:left-3 [&>svg]:size-3.5 [&>svg~*]:pl-6',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive',
        success: 'border-success/40 bg-success/10 text-success [&>svg]:text-success',
        warning: 'border-warning/40 bg-warning/10 text-warning-foreground [&>svg]:text-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-0.5 font-medium text-sm leading-none tracking-tight', className)}
      {...props}
    />
  )
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-xs [&_p]:leading-relaxed', className)} {...props} />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertDescription, AlertTitle, alertVariants }
