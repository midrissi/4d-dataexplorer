import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Named favourite primary line.
 * With a name: show the label only; signature lives behind an info tooltip.
 * Without a name: show the technical detail (signature / path) directly.
 */
export function FavouritePrimaryLabel({
  name,
  detail,
  signatureLabel,
}: {
  name?: string
  detail: ReactNode
  /** Accessible label for the signature info control. */
  signatureLabel?: string
}) {
  if (!name) return <>{detail}</>

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate font-medium font-sans text-[11px] text-foreground">
        {name}
      </span>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={signatureLabel}
              title={signatureLabel}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Info className="h-3 w-3" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-[min(24rem,calc(100vw-2rem))] border-border/70 bg-popover px-2.5 py-1.5 shadow-md"
          >
            <div className="overflow-x-auto font-mono text-[11px] leading-5">{detail}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  )
}
