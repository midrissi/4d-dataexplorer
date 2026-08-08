import { cn } from '@4d/ui'
import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

const chipTone = {
  muted:
    'border-border/55 bg-muted/35 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
  accent:
    'border-primary/25 bg-primary/10 text-foreground dark:border-primary/30 dark:bg-primary/12',
  active:
    'border-primary/40 bg-primary/15 text-foreground ring-1 ring-primary/20 dark:bg-primary/20',
} as const

const chipSize = {
  sm: 'h-3.5 max-w-20 gap-px rounded-[3px] px-1 text-[9px]',
  md: 'h-5 max-w-full gap-0.5 rounded-sm px-1.5 text-[10px]',
} as const

export type TagChipTone = keyof typeof chipTone
export type TagChipSize = keyof typeof chipSize

const chipBase =
  'inline-flex max-w-full items-center border font-medium leading-none transition-colors duration-150'

/** Single tag pill — compact for lists, roomier for editors. */
export function TagChip({
  tag,
  tone = 'muted',
  size = 'md',
  onRemove,
  removeLabel,
  className,
  ...props
}: {
  tag: string
  tone?: TagChipTone
  size?: TagChipSize
  onRemove?: () => void
  removeLabel?: string
  className?: string
} & HTMLAttributes<HTMLSpanElement>) {
  const compact = size === 'sm'
  return (
    <span
      className={cn(chipBase, chipSize[size], chipTone[tone], className)}
      title={tag}
      {...props}
    >
      <span aria-hidden className={cn('select-none text-primary/70', compact && 'text-[8px]')}>
        #
      </span>
      <span className="min-w-0 truncate">{tag}</span>
      {onRemove ? (
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            compact ? '-mr-px ml-px h-3 w-3' : '-mr-0.5 ml-0.5 h-3.5 w-3.5'
          )}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          aria-label={removeLabel ?? `Remove ${tag}`}
        >
          <X className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} aria-hidden />
        </button>
      ) : null}
    </span>
  )
}

/** Filter-bar style chip button. */
export function TagChipButton({
  tag,
  active,
  size = 'sm',
  className,
  ...props
}: {
  tag: string
  active?: boolean
  size?: TagChipSize
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        chipBase,
        chipSize[size],
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        size === 'sm' ? 'max-w-24' : 'max-w-28',
        active ? chipTone.active : chipTone.muted,
        className
      )}
      title={tag}
      aria-pressed={active}
      {...props}
    >
      <span aria-hidden className="select-none text-[8px] text-primary/70">
        #
      </span>
      <span className="min-w-0 truncate">{tag}</span>
    </button>
  )
}
