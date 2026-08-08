import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { TagChip, TagChipButton } from './TagChip'

/**
 * Single-line tag display for dense list rows.
 * Never wraps — shows a few chips then a +N overflow with full list in a tooltip.
 * When `onTagClick` is set, chips filter/select that tag.
 */
export function TagList({
  tags,
  className,
  max = 2,
  tone = 'muted',
  activeTag,
  onTagClick,
}: {
  tags: readonly string[]
  className?: string
  max?: number
  tone?: 'muted' | 'accent'
  activeTag?: string | null
  onTagClick?: (tag: string) => void
}) {
  const { t } = useTranslation()
  if (tags.length === 0) return null
  const visible = tags.slice(0, max)
  const hidden = tags.slice(max)
  const isActive = (tag: string) =>
    activeTag != null && activeTag.toLowerCase() === tag.toLowerCase()

  const renderChip = (tag: string, chipTone: 'muted' | 'accent' = tone) => {
    if (onTagClick) {
      return (
        <TagChipButton
          key={tag.toLowerCase()}
          tag={tag}
          size="sm"
          active={isActive(tag)}
          aria-label={t('tags.filterByTag', { tag })}
          onClick={(event) => {
            event.stopPropagation()
            onTagClick(tag)
          }}
        />
      )
    }
    return <TagChip key={tag.toLowerCase()} tag={tag} tone={chipTone} size="sm" />
  }

  return (
    <div
      className={cn('inline-flex min-w-0 shrink-0 items-center gap-0.5 overflow-hidden', className)}
      title={tags.map((tag) => `#${tag}`).join(' ')}
    >
      {visible.map((tag) => renderChip(tag))}
      {hidden.length > 0 ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-3.5 shrink-0 items-center rounded-[3px] border border-border/60 border-dashed bg-background/30 px-1 font-medium text-[9px] text-muted-foreground tabular-nums transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`+${hidden.length} more tags`}
                onClick={(event) => event.stopPropagation()}
              >
                +{hidden.length}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="flex flex-wrap gap-0.5">
                {tags.map((tag) => renderChip(tag, onTagClick ? tone : 'accent'))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  )
}
