import * as React from 'react'
import { cn } from '../lib/utils'

// Base props for all value components
interface BaseValueProps extends React.HTMLAttributes<HTMLSpanElement> {}

// Null value component
interface NullValueProps extends BaseValueProps {}

const NullValue = React.forwardRef<HTMLSpanElement, NullValueProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border border-current/30 bg-black/10 px-2 py-0.5 text-xs italic opacity-70',
        className
      )}
      {...props}
    >
      null
    </span>
  )
)
NullValue.displayName = 'Value.Null'

// Boolean value component
interface BooleanValueProps extends BaseValueProps {
  value: boolean
  /** Format: 'yesno' shows Yes/No, 'truefalse' shows true/false */
  format?: 'yesno' | 'truefalse'
}

const BooleanValue = React.forwardRef<HTMLSpanElement, BooleanValueProps>(
  ({ className, value, format = 'yesno', ...props }, ref) => {
    const displayValue = format === 'yesno' ? (value ? 'Yes' : 'No') : value ? 'true' : 'false'

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs',
          value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          className
        )}
        {...props}
      >
        {displayValue}
      </span>
    )
  }
)
BooleanValue.displayName = 'Value.Boolean'

// Number value component
interface NumberValueProps extends BaseValueProps {
  value: number
  /** Optional formatter function */
  formatter?: (value: number) => string
}

const NumberValue = React.forwardRef<HTMLSpanElement, NumberValueProps>(
  ({ className, value, formatter, ...props }, ref) => {
    const displayValue = formatter ? formatter(value) : value.toLocaleString()

    return (
      <span
        ref={ref}
        className={cn('font-mono text-amber-600 text-sm dark:text-amber-400', className)}
        {...props}
      >
        {displayValue}
      </span>
    )
  }
)
NumberValue.displayName = 'Value.Number'

// String value component
interface StringValueProps extends BaseValueProps {
  value: string
  /** Truncate string at specified length */
  truncate?: number
}

const StringValue = React.forwardRef<HTMLSpanElement, StringValueProps>(
  ({ className, value, truncate, ...props }, ref) => {
    const displayValue =
      truncate && value.length > truncate ? `${value.slice(0, truncate)}...` : value

    return (
      <span ref={ref} className={cn('text-sm', className)} {...props}>
        {displayValue}
      </span>
    )
  }
)
StringValue.displayName = 'Value.String'

// Date value component
interface DateValueProps extends BaseValueProps {
  value: string | Date
  /** Optional formatter function */
  formatter?: (value: string | Date) => string
}

const DateValue = React.forwardRef<HTMLSpanElement, DateValueProps>(
  ({ className, value, formatter, ...props }, ref) => {
    let displayValue: string
    if (formatter) {
      displayValue = formatter(value)
    } else if (value instanceof Date) {
      displayValue = value.toLocaleDateString()
    } else {
      displayValue = value
    }

    return (
      <span
        ref={ref}
        className={cn('text-emerald-600 text-sm dark:text-emerald-400', className)}
        {...props}
      >
        {displayValue}
      </span>
    )
  }
)
DateValue.displayName = 'Value.Date'

// Duration value component
interface DurationValueProps extends BaseValueProps {
  value: number
  /** Optional formatter function */
  formatter?: (value: number) => string
}

const DurationValue = React.forwardRef<HTMLSpanElement, DurationValueProps>(
  ({ className, value, formatter, ...props }, ref) => {
    const displayValue = formatter ? formatter(value) : `${value}ms`

    return (
      <span
        ref={ref}
        className={cn('font-mono text-cyan-600 text-sm dark:text-cyan-400', className)}
        {...props}
      >
        {displayValue}
      </span>
    )
  }
)
DurationValue.displayName = 'Value.Duration'

// URL value component
interface UrlValueProps extends BaseValueProps {
  value: string
  /** Truncate display text at specified length (href remains full URL) */
  truncate?: number
}

const UrlValue = React.forwardRef<
  HTMLAnchorElement,
  UrlValueProps & React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, value, truncate, ...props }, ref) => {
  const displayValue =
    truncate && value.length > truncate ? `${value.slice(0, truncate)}...` : value

  return (
    <a
      ref={ref}
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-blue-600 text-sm hover:underline dark:text-blue-400', className)}
      {...props}
    >
      {displayValue}
    </a>
  )
})
UrlValue.displayName = 'Value.Url'

// Object value component (for arrays and objects)
interface ObjectValueProps extends BaseValueProps {
  value: unknown[] | Record<string, unknown>
}

const ObjectValue = React.forwardRef<HTMLSpanElement, ObjectValueProps>(
  ({ className, value, ...props }, ref) => {
    const displayValue = Array.isArray(value) ? `[${value.length} items]` : '{...}'

    return (
      <span ref={ref} className={cn('text-sm italic opacity-70', className)} {...props}>
        {displayValue}
      </span>
    )
  }
)
ObjectValue.displayName = 'Value.Object'

// Compound component
export const Value = {
  Null: NullValue,
  Boolean: BooleanValue,
  Number: NumberValue,
  String: StringValue,
  Date: DateValue,
  Duration: DurationValue,
  Url: UrlValue,
  Object: ObjectValue,
}

// Export individual components and their props for flexibility
export type {
  BooleanValueProps,
  DateValueProps,
  DurationValueProps,
  NullValueProps,
  NumberValueProps,
  ObjectValueProps,
  StringValueProps,
  UrlValueProps,
}
