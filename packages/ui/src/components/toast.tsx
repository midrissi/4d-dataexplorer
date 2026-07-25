'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'

const toastVariants = cva(
  [
    'pointer-events-auto relative flex w-full max-w-md gap-3 overflow-hidden rounded-md border-2 p-3',
    'bg-popover text-popover-foreground',
    'fade-in-0 slide-in-from-bottom-3 zoom-in-95 animate-in duration-fast',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-border bg-popover',
        destructive: 'border-destructive bg-popover',
        success: 'border-success bg-popover',
        warning: 'border-warning bg-popover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const toastIconWellVariants = cva(
  'flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-muted text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        success: 'bg-success text-success-foreground',
        warning: 'bg-warning text-warning-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const toastTitleVariants = cva('font-semibold text-sm leading-snug', {
  variants: {
    variant: {
      default: 'text-foreground',
      destructive: 'text-destructive',
      success: 'text-success',
      warning: 'text-warning-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const toastDescriptionVariants = cva('wrap-break-word text-xs leading-relaxed', {
  variants: {
    variant: {
      default: 'text-muted-foreground',
      destructive: 'text-destructive/90',
      success: 'text-success/90',
      warning: 'text-warning-foreground/90',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const toastProgressVariants = cva('absolute inset-x-0 bottom-0 h-1 origin-left', {
  variants: {
    variant: {
      default: 'bg-foreground/30',
      destructive: 'bg-destructive',
      success: 'bg-success',
      warning: 'bg-warning',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export type ToastVariant = NonNullable<VariantProps<typeof toastVariants>['variant']>

const DEFAULT_ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <Info />,
  destructive: <XCircle />,
  success: <CheckCircle2 />,
  warning: <AlertTriangle />,
}

export type ToastProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> &
  VariantProps<typeof toastVariants> & {
    title?: React.ReactNode
    description?: React.ReactNode
    icon?: React.ReactNode | false
    onClose?: () => void
    closeLabel?: string
    /** Auto-dismiss duration in ms; shows a progress bar when set. */
    duration?: number
  }

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      className,
      variant = 'default',
      title,
      description,
      icon,
      onClose,
      closeLabel = 'Close',
      duration,
      children,
      ...props
    },
    ref
  ) => {
    const resolvedVariant = variant ?? 'default'
    const showIcon = icon !== false
    const resolvedIcon = icon === false ? null : (icon ?? DEFAULT_ICONS[resolvedVariant])

    return (
      <div
        ref={ref}
        role={resolvedVariant === 'destructive' ? 'alert' : 'status'}
        aria-live={resolvedVariant === 'destructive' ? 'assertive' : 'polite'}
        className={cn(toastVariants({ variant: resolvedVariant }), className)}
        {...props}
      >
        {showIcon ? (
          <div className={cn(toastIconWellVariants({ variant: resolvedVariant }))}>
            {resolvedIcon}
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1 pt-0.5">
          {title ? (
            <p className={cn(toastTitleVariants({ variant: resolvedVariant }))}>{title}</p>
          ) : null}
          {description ? (
            <p className={cn(toastDescriptionVariants({ variant: resolvedVariant }))}>
              {description}
            </p>
          ) : null}
          {children}
        </div>

        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="iconXs"
            className={cn(
              '-mt-0.5 -mr-0.5 shrink-0',
              resolvedVariant === 'destructive' &&
                'text-destructive hover:bg-destructive/15 hover:text-destructive',
              resolvedVariant === 'success' &&
                'text-success hover:bg-success/15 hover:text-success',
              resolvedVariant === 'warning' &&
                'text-warning-foreground hover:bg-warning/20 hover:text-warning-foreground',
              resolvedVariant === 'default' && 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X />
          </Button>
        ) : null}

        {typeof duration === 'number' && duration > 0 ? (
          <div
            className={cn(toastProgressVariants({ variant: resolvedVariant }))}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        ) : null}
      </div>
    )
  }
)
Toast.displayName = 'Toast'

const ToastViewport = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="toast-viewport"
      className={cn(
        // Clear the h-8 app footer so toasts sit above chrome, not on top of it.
        'pointer-events-none fixed inset-x-0 bottom-10 z-[100] flex max-h-screen flex-col-reverse items-center gap-2 px-4 sm:items-end sm:px-5',
        className
      )}
      {...props}
    />
  )
)
ToastViewport.displayName = 'ToastViewport'

export {
  Toast,
  ToastViewport,
  toastDescriptionVariants,
  toastIconWellVariants,
  toastProgressVariants,
  toastTitleVariants,
  toastVariants,
}
