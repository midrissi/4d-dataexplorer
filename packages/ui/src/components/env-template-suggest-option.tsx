import { Braces, Filter, Sparkles, WandSparkles } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'
import type { EnvTemplateSuggestion } from './env-template-autocomplete'
import { EnvTemplateExampleTooltip } from './env-template-example-tooltip'

export const EnvTemplateSuggestOption = React.memo(function EnvTemplateSuggestOption({
  id,
  index,
  item,
  previousGroup,
  groupLabels,
  selected,
  previewOpen,
  onHover,
  onSelect,
  onPreviewChange,
}: {
  id: string
  index: number
  item: EnvTemplateSuggestion
  previousGroup?: string
  groupLabels?: Readonly<Record<string, string>>
  selected: boolean
  previewOpen: boolean
  onHover: (index: number) => void
  onSelect: (item: EnvTemplateSuggestion) => void
  onPreviewChange: (key: string | null) => void
}) {
  const showGroup = Boolean(item.group && groupLabels?.[item.group]) && item.group !== previousGroup
  const isDynamic = item.group === 'dynamic'
  const isFilter = item.group === 'filter'
  const isContext = item.group === 'context'
  const isField = item.group === 'field'
  const itemId = `${item.group ?? ''}:${item.key}`

  return (
    <div>
      {showGroup && item.group ? (
        <div
          className={cn(
            'sticky top-0 z-10 flex items-center gap-1.5 bg-popover/95 px-2 pt-1.5 pb-1 backdrop-blur-sm',
            index > 0 && 'mt-0.5 border-border/60 border-t'
          )}
        >
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              isField
                ? 'bg-emerald-400'
                : isDynamic
                  ? 'bg-sky-400'
                  : isFilter
                    ? 'bg-violet-400'
                    : isContext
                      ? 'bg-amber-400'
                      : 'bg-primary'
            )}
            aria-hidden
          />
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            {groupLabels?.[item.group]}
          </span>
        </div>
      ) : null}
      <div
        id={`${id}-option-${index}`}
        role="option"
        tabIndex={-1}
        aria-selected={selected}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onSelect(item)
        }}
        onMouseEnter={() => onHover(index)}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-left outline-none',
          'transition-colors duration-fast',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring',
          selected && 'bg-accent text-accent-foreground'
        )}
      >
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-fast',
            isField
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400'
              : isDynamic
                ? 'border-sky-400/25 bg-sky-400/10 text-sky-500 dark:text-sky-400'
                : isFilter
                  ? 'border-violet-400/25 bg-violet-400/10 text-violet-500 dark:text-violet-400'
                  : isContext
                    ? 'border-amber-400/25 bg-amber-400/10 text-amber-600 dark:text-amber-400'
                    : 'border-primary/20 bg-primary/10 text-primary'
          )}
          aria-hidden
        >
          {isField ? (
            <WandSparkles className="size-3" />
          ) : isDynamic ? (
            <Sparkles className="size-3" />
          ) : isFilter ? (
            <Filter className="size-3" />
          ) : (
            <Braces className="size-3" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs leading-snug">
              {item.key}
            </span>
            {item.example ? (
              <EnvTemplateExampleTooltip
                suggestionKey={item.key}
                example={item.example}
                open={previewOpen}
                onOpenChange={(open) => onPreviewChange(open ? itemId : null)}
              />
            ) : null}
          </span>
          {item.detail ? (
            <span
              className={cn(
                'mt-0.5 block truncate text-[11px] leading-snug',
                selected ? 'text-accent-foreground/70' : 'text-muted-foreground'
              )}
            >
              {item.detail}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  )
})
