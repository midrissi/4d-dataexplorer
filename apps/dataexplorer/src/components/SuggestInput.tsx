import { cn, type EnvVarLookup, type EnvWriteTarget, Input, TemplatedValueDisplay } from '@4d/ui'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { measureSuggestionPlacement } from '~/components/QueryBuilder/AttributePathInput'

type SuggestionPlacement = ReturnType<typeof measureSuggestionPlacement>

export type SuggestFilterMode = 'prefix' | 'includes' | 'off'

export type SuggestOption = {
  value: string
  /** Group key for section headers (resolved via `groupLabels`). */
  group?: string
}

export type SuggestInputSuggestion = string | SuggestOption

function normalizeSuggestions(suggestions: readonly SuggestInputSuggestion[]): SuggestOption[] {
  return suggestions.map((item) => (typeof item === 'string' ? { value: item } : item))
}

function filterSuggestions(
  suggestions: readonly SuggestOption[],
  value: string,
  mode: SuggestFilterMode
): SuggestOption[] {
  if (mode === 'off') return [...suggestions]
  const q = value.trim().toLowerCase()
  if (!q) return [...suggestions]
  return suggestions.filter((item) => {
    const lower = item.value.toLowerCase()
    if (lower === q) return false
    return mode === 'includes' ? lower.includes(q) : lower.startsWith(q)
  })
}

function hasEnvTemplate(value: string): boolean {
  return value.includes('{{') && value.includes('}}')
}

export function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  inputClassName,
  id,
  'aria-label': ariaLabel,
  filter = 'prefix',
  minListWidth,
  disabled,
  groupLabels,
  resolveVariable,
  onVariableChange,
  onManageVariables,
  manageVariablesLabel,
  writeTargets,
  addToLabel,
  unresolvedLabel,
  valuePlaceholder,
  highlightClassName,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: readonly SuggestInputSuggestion[]
  placeholder?: string
  /** Wrapper class (flex sizing, etc.). */
  className?: string
  inputClassName?: string
  id?: string
  'aria-label'?: string
  /** How to narrow the list. Use `off` when the parent already contextualizes suggestions. */
  filter?: SuggestFilterMode
  minListWidth?: number
  disabled?: boolean
  /** Maps `SuggestOption.group` keys to visible section titles. */
  groupLabels?: Readonly<Record<string, string>>
  /** When set with `onVariableChange`, show env chips while not editing. */
  resolveVariable?: (key: string) => EnvVarLookup | null
  onVariableChange?: (key: string, value: string, scope?: string) => void
  onManageVariables?: () => void
  manageVariablesLabel?: string
  writeTargets?: readonly EnvWriteTarget[]
  addToLabel?: string
  unresolvedLabel?: string
  valuePlaceholder?: string
  /** Classes for the chip highlight surface (defaults to `inputClassName`). */
  highlightClassName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [placement, setPlacement] = useState<SuggestionPlacement | null>(null)

  const templatingEnabled = Boolean(resolveVariable && onVariableChange)
  const showHighlight = templatingEnabled && !editing && !disabled && hasEnvTemplate(value)
  // Don't offer path/catalog picks over in-progress or completed {{templates}}.
  const suppressSuggestions = hasEnvTemplate(value)

  const normalized = useMemo(() => normalizeSuggestions(suggestions), [suggestions])

  const filtered = useMemo(
    () => (suppressSuggestions ? [] : filterSuggestions(normalized, value, filter)),
    [filter, normalized, suppressSuggestions, value]
  )

  const showSuggestions = open && !showHighlight && filtered.length > 0
  const safeActiveIndex = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1)
  const activeOptionId = showSuggestions ? `${listboxId}-option-${safeActiveIndex}` : undefined

  useEffect(() => {
    if (editing && !showHighlight) inputRef.current?.focus()
  }, [editing, showHighlight])

  useLayoutEffect(() => {
    if (!showSuggestions) {
      setPlacement(null)
      return
    }

    const updatePlacement = () => {
      const input = inputRef.current
      if (!input) return
      setPlacement(measureSuggestionPlacement(input.getBoundingClientRect(), window.innerHeight))
    }

    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [showSuggestions])

  useEffect(() => {
    if (!showSuggestions) return
    document
      .getElementById(`${listboxId}-option-${safeActiveIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [safeActiveIndex, listboxId, showSuggestions])

  const commitSuggestion = (item: string) => {
    onChange(item)
    setActiveIndex(0)
    setOpen(false)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (event.key === 'ArrowDown' && filtered.length > 0) {
        event.preventDefault()
        setOpen(true)
        setActiveIndex(0)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (event.key === 'Enter') {
      const selected = filtered[safeActiveIndex]
      if (!selected) return
      event.preventDefault()
      commitSuggestion(selected.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  if (showHighlight && resolveVariable && onVariableChange) {
    return (
      <div className={cn('relative', className)}>
        <TemplatedValueDisplay
          value={value}
          resolveVariable={resolveVariable}
          onVariableChange={onVariableChange}
          onManageVariables={onManageVariables}
          manageVariablesLabel={manageVariablesLabel}
          writeTargets={writeTargets}
          addToLabel={addToLabel}
          unresolvedLabel={unresolvedLabel}
          valuePlaceholder={valuePlaceholder}
          aria-label={ariaLabel}
          onStartEdit={() => {
            setEditing(true)
            setOpen(true)
          }}
          className={cn(
            'min-h-0 items-center border-0 bg-transparent px-2 py-0 leading-none shadow-none focus-visible:ring-0',
            highlightClassName ?? inputClassName
          )}
        />
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveIndex(0)
          setOpen(true)
          setEditing(true)
        }}
        onFocus={() => {
          setEditing(true)
          setOpen(true)
        }}
        onBlur={() => {
          // Delay so option mousedown can commit before the list unmounts.
          window.setTimeout(() => {
            setOpen(false)
            setEditing(false)
          }, 120)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        className={inputClassName}
      />
      {showSuggestions && placement
        ? createPortal(
            <div
              id={listboxId}
              role="listbox"
              style={{
                position: 'fixed',
                top: placement.side === 'bottom' ? placement.top : undefined,
                bottom: placement.side === 'top' ? window.innerHeight - placement.top : undefined,
                left: placement.left,
                width: Math.max(placement.width, minListWidth ?? 0),
                maxHeight: placement.maxHeight,
              }}
              className="z-50 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {filtered.map((item, index) => {
                const prevGroup = index > 0 ? filtered[index - 1]?.group : undefined
                const showGroup =
                  Boolean(item.group && groupLabels?.[item.group]) && item.group !== prevGroup
                return (
                  <div key={`${item.group ?? ''}:${item.value}`}>
                    {showGroup && item.group ? (
                      <div className="px-2 pt-1.5 pb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                        {groupLabels?.[item.group]}
                      </div>
                    ) : null}
                    <button
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === safeActiveIndex}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        commitSuggestion(item.value)
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex w-full min-w-0 cursor-pointer rounded-md px-2 py-1.5 text-left',
                        'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                        index === safeActiveIndex && 'bg-muted/70'
                      )}
                    >
                      <span className="truncate font-mono text-xs">{item.value}</span>
                    </button>
                  </div>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
