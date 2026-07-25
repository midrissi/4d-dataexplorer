import { cn, Label, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import * as React from 'react'
import { useSchemaBuilderI18n } from './schema-builder'

export interface LabelWithClearProps {
  /** Label text (or field name). */
  label: string
  /** When true, highlight the label and allow clearing via tooltip. */
  hasValue: boolean
  /** Called when the user chooses to clear. */
  onClear: () => void
  /** Optional id to associate with an input (e.g. for accessibility). */
  htmlFor?: string
  className?: string
}

/**
 * Renders a label for a schema property. When the property has a value (hasValue),
 * the label is highlighted; clicking it opens a tooltip with an option to reset (clear) the value.
 */
export function LabelWithClear({
  label,
  hasValue,
  onClear,
  htmlFor,
  className,
}: LabelWithClearProps) {
  const t = useSchemaBuilderI18n()
  const [open, setOpen] = React.useState(false)

  const wrapperClass = cn('flex items-center gap-1', className)
  const labelBoxClass =
    'flex h-5 min-w-0 items-center whitespace-nowrap rounded px-1.5 text-left font-medium text-xs leading-none'

  if (!hasValue) {
    return (
      <div className={wrapperClass}>
        <Label htmlFor={htmlFor} className={cn(labelBoxClass, 'text-muted-foreground')}>
          {label}
        </Label>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      {htmlFor && (
        <Label htmlFor={htmlFor} className="sr-only">
          {label}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              labelBoxClass,
              'text-foreground hover:underline hover:underline-offset-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'bg-muted hover:bg-muted/80'
            )}
            aria-label={`${label} ${t('commonHasValueClickToReset')}`}
          >
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto px-3 py-2">
          <button
            type="button"
            className="text-muted-foreground text-xs hover:text-foreground"
            onClick={() => {
              onClear()
              setOpen(false)
            }}
          >
            {t('commonResetValue')}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
