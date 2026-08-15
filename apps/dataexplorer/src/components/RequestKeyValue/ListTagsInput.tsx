import { cn } from '@4d/ui'
import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from 'react'
import { TagChip } from '~/components/Tags'
import { useTranslation } from '~/i18n'

export function parseListParamTags(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function serializeListParamTags(tags: readonly string[]): string {
  return tags.join(',')
}

/**
 * Compact freeform chip field for comma-separated REST params (`$attributes`, `$expand`).
 * Visual language matches favourite TagInput, without the used-tags catalog.
 */
export function ListTagsInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const tags = parseListParamTags(value)

  const commit = (raw: string) => {
    const label = raw.trim()
    if (!label || disabled) return
    const exists = tags.some((tag) => tag.toLowerCase() === label.toLowerCase())
    if (exists) {
      setDraft('')
      return
    }
    onChange(serializeListParamTags([...tags, label]))
    setDraft('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const removeAt = (index: number) => {
    if (disabled) return
    onChange(serializeListParamTags(tags.filter((_, i) => i !== index)))
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      if (draft.trim()) commit(draft)
      return
    }
    // Tab with a pending draft: commit via onBlur (fired automatically) and let
    // the browser move focus to the next element without preventDefault.
    if (event.key === 'Tab' && draft.trim()) {
      commit(draft)
      return
    }
    if (event.key === 'Backspace' && !draft && tags.length > 0) {
      event.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!text || (!text.includes(',') && !text.includes('\n') && !/\s{2,}/.test(text))) return
    event.preventDefault()
    const parts = text
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    let next = [...tags]
    for (const part of parts) {
      const exists = next.some((tag) => tag.toLowerCase() === part.toLowerCase())
      if (!exists) next = [...next, part]
    }
    onChange(serializeListParamTags(next))
    setDraft('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click empty chrome focuses the tag input
    <div
      className={cn(
        'flex min-h-7 w-full flex-wrap items-center gap-1.5 bg-transparent px-2 py-1',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault()
          inputRef.current?.focus()
        }
      }}
    >
      {tags.map((tag, index) => (
        <TagChip
          key={tag.toLowerCase()}
          tag={tag}
          size="md"
          tone="muted"
          onRemove={disabled ? undefined : () => removeAt(index)}
          removeLabel={t('tags.removeTag', { tag })}
        />
      ))}
      <input
        ref={inputRef}
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={tags.length === 0 ? placeholder : undefined}
        className="min-w-20 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        onChange={(event) => setDraft(event.target.value.replace(/,/g, ''))}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) commit(draft)
        }}
      />
    </div>
  )
}
