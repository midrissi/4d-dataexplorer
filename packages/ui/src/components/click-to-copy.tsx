import type { JSX } from 'react'
import * as React from 'react'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

const COPIED_DURATION_MS = 2000
const TOOLTIP_CLOSE_DELAY_MS = 200

/** HTML element tag names supported by the `as` prop */
export type ClickToCopyAs = keyof JSX.IntrinsicElements

export interface ClickToCopyProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Render as this HTML element. Defaults to "button". */
  as?: ClickToCopyAs
  /** Value to copy to the clipboard when clicked */
  value: string
  /** Content to show. Defaults to `value`. */
  children?: React.ReactNode
  /** Tooltip text when idle. Defaults to "Click to copy". */
  tooltipLabel?: string
  /** Tooltip text after copy. Defaults to "Copied!". */
  tooltipCopiedLabel?: string
}

/**
 * A component that copies a value to the clipboard on click and shows
 * a tooltip ("Click to copy" / "Copied!"). Stops event propagation so
 * it can be used inside clickable parents (e.g. list items).
 * Use the `as` prop to render as a different element (e.g. "span", "code").
 */
export const ClickToCopy = React.forwardRef<HTMLElement, ClickToCopyProps>(
  (
    {
      as = 'button',
      value,
      children,
      className,
      tooltipLabel = 'Click to copy',
      tooltipCopiedLabel = 'Copied!',
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const isButton = as === 'button'

    const [copied, setCopied] = React.useState(false)
    const [tooltipOpen, setTooltipOpen] = React.useState(false)
    const [tooltipMessage, setTooltipMessage] = React.useState(tooltipLabel)

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation()
        onClick?.(e)
        const text = String(value ?? '')
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTooltipMessage(tooltipCopiedLabel)
          window.setTimeout(() => {
            setCopied(false)
            window.setTimeout(() => setTooltipMessage(tooltipLabel), TOOLTIP_CLOSE_DELAY_MS)
          }, COPIED_DURATION_MS)
        })
      },
      [value, tooltipLabel, tooltipCopiedLabel, onClick]
    )

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (!isButton && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.currentTarget.click()
        }
        onKeyDown?.(e)
      },
      [isButton, onKeyDown]
    )

    const handleTooltipOpenChange = React.useCallback(
      (open: boolean) => {
        if (!copied) setTooltipOpen(open)
      },
      [copied]
    )

    const triggerProps: React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> } = {
      ref: ref as React.Ref<HTMLElement>,
      className: cn(
        'cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      ),
      onClick: handleClick,
      ...(isButton ? { type: 'button' as const } : { role: 'button' as const, tabIndex: 0 }),
      ...(!isButton && { onKeyDown: handleKeyDown }),
      ...props,
    }

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip open={copied || tooltipOpen} onOpenChange={handleTooltipOpenChange}>
          <TooltipTrigger asChild>
            {React.createElement(as as string, triggerProps, children ?? value)}
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
ClickToCopy.displayName = 'ClickToCopy'
