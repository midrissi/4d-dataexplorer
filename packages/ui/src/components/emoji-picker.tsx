import { Search } from 'lucide-react'
import * as React from 'react'
import { EMOJI_CATEGORIES, type EmojiCategoryId, filterEmojis } from '../lib/emoji-data'
import { cn } from '../lib/utils'
import { Button } from './button'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { ScrollArea } from './scroll-area'

export type EmojiSelectModifiers = {
  shiftKey: boolean
  metaKey: boolean
  altKey: boolean
  ctrlKey: boolean
}

export type EmojiPickerLabels = {
  title: string
  search: string
  searchPlaceholder: string
  clear: string
  empty: string
  categories: Record<EmojiCategoryId, string>
}

export const DEFAULT_EMOJI_PICKER_LABELS: EmojiPickerLabels = {
  title: 'Choose emoji',
  search: 'Search',
  searchPlaceholder: 'Search emoji…',
  clear: 'No emoji',
  empty: 'No matching emoji',
  categories: {
    professional: 'Professional',
    smileys: 'Smileys & emotion',
    people: 'People & body',
    nature: 'Animals & nature',
    food: 'Food & drink',
    activity: 'Activity',
    travel: 'Travel & places',
    objects: 'Objects',
    symbols: 'Symbols',
    flags: 'Flags',
  },
}

export type EmojiPickerProps = {
  value?: string
  onSelect: (emoji: string, modifiers: EmojiSelectModifiers) => void
  onClear?: (modifiers: EmojiSelectModifiers) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  labels?: Partial<EmojiPickerLabels>
  hint?: React.ReactNode
  defaultCategory?: EmojiCategoryId
  triggerAriaLabel?: string
  className?: string
  contentClassName?: string
  children?: React.ReactNode
}

function modifiersFromEvent(event: React.MouseEvent | React.KeyboardEvent): EmojiSelectModifiers {
  return {
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
  }
}

export function EmojiPicker({
  value = '',
  onSelect,
  onClear,
  open,
  onOpenChange,
  labels: labelsProp,
  hint,
  defaultCategory = 'professional',
  triggerAriaLabel,
  className,
  contentClassName,
  children,
}: EmojiPickerProps) {
  const labels = mergeLabels(labelsProp)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<EmojiCategoryId>(defaultCategory)
  const isOpen = open ?? uncontrolledOpen

  const emojis = React.useMemo(
    () => filterEmojis(query, query.trim() ? 'all' : categoryId),
    [query, categoryId]
  )

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery('')
      setCategoryId(defaultCategory)
    }
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  function pick(emoji: string, modifiers: EmojiSelectModifiers) {
    onSelect(emoji, modifiers)
    handleOpenChange(false)
  }

  function clear(modifiers: EmojiSelectModifiers) {
    onClear?.(modifiers)
    if (!onClear) onSelect('', modifiers)
    handleOpenChange(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={className}
            aria-label={triggerAriaLabel ?? labels.title}
          >
            <span aria-hidden>{value || '😀'}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn('w-80 p-2.5', contentClassName)}
        aria-label={labels.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            {labels.title}
          </p>
          {value ? (
            <span className="text-base leading-none" aria-hidden>
              {value}
            </span>
          ) : null}
        </div>
        <div className="relative mb-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.search}
            className="h-8 pl-7"
            autoFocus
          />
        </div>
        <nav className="mb-2 flex gap-0.5 overflow-x-auto pb-0.5">
          {EMOJI_CATEGORIES.map((category) => {
            const active = category.id === categoryId && !query.trim()
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                aria-label={labels.categories[category.id]}
                title={labels.categories[category.id]}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-base leading-none',
                  'text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'bg-muted ring-1 ring-border'
                )}
                onClick={() => {
                  setCategoryId(category.id)
                  setQuery('')
                }}
              >
                <span aria-hidden>{category.icon}</span>
              </button>
            )
          })}
        </nav>
        <ScrollArea className="h-56 pr-1">
          {emojis.length === 0 ? (
            <p className="px-1 py-6 text-center text-muted-foreground text-xs" role="status">
              {labels.empty}
            </p>
          ) : (
            <div className="grid grid-cols-8 gap-0.5">
              {emojis.map((emoji) => {
                const selected = emoji === value
                return (
                  <button
                    key={emoji}
                    type="button"
                    aria-pressed={selected}
                    aria-label={emoji}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-sm text-base leading-none',
                      'text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'transition-colors duration-fast',
                      selected && 'bg-muted ring-1 ring-border'
                    )}
                    onClick={(event) => pick(emoji, modifiersFromEvent(event))}
                  >
                    <span aria-hidden>{emoji}</span>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
        {hint ? (
          <div className="mt-2 text-[10px] text-muted-foreground leading-snug">{hint}</div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 h-8 w-full select-none text-xs"
          onPointerDown={(event) => {
            if (!event.shiftKey) return
            event.preventDefault()
            clear(modifiersFromEvent(event))
          }}
          onClick={(event) => {
            if (event.shiftKey) return
            clear(modifiersFromEvent(event))
          }}
        >
          {labels.clear}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function mergeLabels(partial?: Partial<EmojiPickerLabels>): EmojiPickerLabels {
  if (!partial) return DEFAULT_EMOJI_PICKER_LABELS
  return {
    ...DEFAULT_EMOJI_PICKER_LABELS,
    ...partial,
    categories: {
      ...DEFAULT_EMOJI_PICKER_LABELS.categories,
      ...partial.categories,
    },
  }
}
