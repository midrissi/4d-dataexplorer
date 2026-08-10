import * as React from 'react'
import { cn } from '../lib/utils'
import { type EnvVarLookup, parseEnvTemplateSegments } from './env-template'
import type { EnvTemplateSuggestion } from './env-template-autocomplete'
import { EnvTemplateSuggestList, useEnvTemplateAutocomplete } from './env-template-autocomplete-ui'
import {
  type EnvVariableChangeHandler,
  EnvVariableChip,
  type EnvWriteTarget,
} from './env-variable-chip'
import { Input } from './input'
import { Textarea } from './textarea'

export type TemplatedFieldSharedProps = {
  value: string
  onChange: (next: string) => void
  resolveVariable: (key: string) => EnvVarLookup | null
  onVariableChange: EnvVariableChangeHandler
  onManageVariables?: () => void
  manageVariablesLabel?: string
  writeTargets?: readonly EnvWriteTarget[]
  addToLabel?: string
  unresolvedLabel?: string
  valuePlaceholder?: string
  /** Keys offered while typing `{{` (env + dynamic). */
  variableSuggestions?: readonly EnvTemplateSuggestion[]
  variableGroupLabels?: Readonly<Record<string, string>>
  className?: string
  disabled?: boolean
  placeholder?: string
  id?: string
  name?: string
  'aria-label'?: string
}

function hasEnvTemplate(value: string): boolean {
  return value.includes('{{') && value.includes('}}')
}

export type TemplatedValueDisplayProps = {
  value: string
  resolveVariable: (key: string) => EnvVarLookup | null
  onVariableChange: EnvVariableChangeHandler
  onManageVariables?: () => void
  manageVariablesLabel?: string
  writeTargets?: readonly EnvWriteTarget[]
  addToLabel?: string
  unresolvedLabel?: string
  valuePlaceholder?: string
  onStartEdit: () => void
  className?: string
  'aria-label'?: string
  /**
   * Decorative overlay on top of a real input (not in the a11y/tab tree).
   * Use for chip preview while the underlying control stays the tab stop.
   */
  overlay?: boolean
  /**
   * Word-wrap chips with surrounding text (textarea). Single-line inputs keep
   * a horizontal flex strip that scrolls instead of wrapping.
   */
  multiline?: boolean
}

/** Read-only chip/highlight view for strings that contain `{{var}}` segments. */
export function TemplatedValueDisplay({
  value,
  resolveVariable,
  onVariableChange,
  onManageVariables,
  manageVariablesLabel,
  writeTargets,
  addToLabel,
  unresolvedLabel,
  valuePlaceholder,
  onStartEdit,
  className,
  'aria-label': ariaLabel,
  overlay = false,
  multiline = false,
}: TemplatedValueDisplayProps) {
  const segments = React.useMemo(() => parseEnvTemplateSegments(value), [value])

  const chipContent = segments.map((segment) => {
    if (segment.kind === 'text') {
      return (
        <span
          key={`t-${segment.offset}`}
          className={cn(
            multiline
              ? 'max-w-full whitespace-pre-wrap break-words'
              : 'inline-flex items-center whitespace-pre leading-none'
          )}
        >
          {segment.text}
        </span>
      )
    }
    return (
      <EnvVariableChip
        key={`v-${segment.offset}-${segment.key}`}
        raw={segment.raw}
        variableKey={segment.key}
        lookup={resolveVariable(segment.key)}
        onVariableChange={onVariableChange}
        onManageVariables={onManageVariables}
        manageVariablesLabel={manageVariablesLabel}
        writeTargets={writeTargets}
        addToLabel={addToLabel}
        unresolvedLabel={unresolvedLabel}
        valuePlaceholder={valuePlaceholder}
        className={multiline ? 'max-w-full shrink align-baseline' : undefined}
      />
    )
  })

  const surfaceClassName = cn(
    'w-full min-w-0 cursor-text rounded-sm border border-input bg-background px-2.5 font-mono text-foreground text-sm',
    multiline
      ? // Inline-friendly wrap: chips stay in the text flow ("Hello {{var}}!").
        'flex flex-wrap content-start items-baseline gap-x-0 gap-y-0.5 overflow-auto py-1.5 leading-normal'
      : 'flex flex-nowrap items-center gap-y-0 overflow-x-auto overflow-y-hidden py-0 leading-none',
    // Overlay must fill the real control without growing past it (e.g. h-6 arg rows).
    overlay ? 'h-full max-h-full min-h-0' : 'min-h-7',
    !overlay &&
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
    className
  )

  if (overlay) {
    return (
      <div
        aria-hidden
        className={surfaceClassName}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.env-var-chip')) return
          // Keep focus on the real input; don't let the overlay steal it.
          e.preventDefault()
          onStartEdit()
        }}
      >
        {chipContent}
      </div>
    )
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: chip preview surface; focuses a real <input> on edit
    <div
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      className={surfaceClassName}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.env-var-chip')) return
        onStartEdit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onStartEdit()
        }
      }}
    >
      {chipContent}
    </div>
  )
}

export type TemplatedTextInputProps = TemplatedFieldSharedProps &
  Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'>

export const TemplatedTextInput = React.forwardRef<HTMLInputElement, TemplatedTextInputProps>(
  (
    {
      value,
      onChange,
      resolveVariable,
      onVariableChange,
      onManageVariables,
      manageVariablesLabel,
      writeTargets,
      addToLabel,
      unresolvedLabel,
      valuePlaceholder,
      variableSuggestions = [],
      variableGroupLabels,
      className,
      disabled,
      onBlur,
      onFocus,
      onKeyDown,
      onSelect,
      onClick,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = React.useState(false)
    const [draft, setDraft] = React.useState(value)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const valueRef = React.useRef(value)
    const draftRef = React.useRef(draft)
    valueRef.current = value
    draftRef.current = draft
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    // Keep the real <input> mounted so Tab can leave the field. Chips are a visual overlay only.
    const showHighlight = !focused && !disabled && hasEnvTemplate(draft)
    const autocomplete = useEnvTemplateAutocomplete({
      value: draft,
      onChange: (next) => {
        setDraft(next)
        draftRef.current = next
      },
      suggestions: variableSuggestions,
      groupLabels: variableGroupLabels,
      enabled: !disabled && variableSuggestions.length > 0,
      inputRef,
    })

    React.useEffect(() => {
      if (!focused) setDraft(value)
    }, [value, focused])

    const commitDraft = React.useCallback(() => {
      const next = draftRef.current
      if (next !== valueRef.current) onChange(next)
    }, [onChange])

    const startEdit = React.useCallback(() => {
      inputRef.current?.focus()
    }, [])

    return (
      <div className="relative flex w-full min-w-0 items-center">
        {showHighlight ? (
          <TemplatedValueDisplay
            value={draft}
            resolveVariable={resolveVariable}
            onVariableChange={onVariableChange}
            onManageVariables={onManageVariables}
            manageVariablesLabel={manageVariablesLabel}
            writeTargets={writeTargets}
            addToLabel={addToLabel}
            unresolvedLabel={unresolvedLabel}
            valuePlaceholder={valuePlaceholder}
            onStartEdit={startEdit}
            overlay
            className={cn('absolute inset-0 z-10', className)}
            aria-label={props['aria-label']}
          />
        ) : null}
        <Input
          {...props}
          ref={inputRef}
          value={draft}
          disabled={disabled}
          className={cn(
            'font-mono',
            className,
            showHighlight && 'text-transparent caret-transparent selection:bg-transparent'
          )}
          onChange={(e) => {
            const next = e.target.value
            const cursor = e.target.selectionStart ?? next.length
            autocomplete.onValueChange(next, cursor)
          }}
          onClick={(e) => {
            autocomplete.syncCursor()
            onClick?.(e)
          }}
          onSelect={(e) => {
            autocomplete.syncCursor()
            onSelect?.(e)
          }}
          onKeyDown={(e) => {
            autocomplete.onKeyDown(e)
            if (!e.defaultPrevented) onKeyDown?.(e)
          }}
          onFocus={(e) => {
            setFocused(true)
            autocomplete.syncCursor()
            onFocus?.(e)
          }}
          onBlur={(e) => {
            autocomplete.onBlur()
            commitDraft()
            setFocused(false)
            onBlur?.(e)
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {autocomplete.listProps ? <EnvTemplateSuggestList {...autocomplete.listProps} /> : null}
      </div>
    )
  }
)
TemplatedTextInput.displayName = 'TemplatedTextInput'

export type TemplatedTextareaProps = TemplatedFieldSharedProps &
  Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange'>

export const TemplatedTextarea = React.forwardRef<HTMLTextAreaElement, TemplatedTextareaProps>(
  (
    {
      value,
      onChange,
      resolveVariable,
      onVariableChange,
      onManageVariables,
      manageVariablesLabel,
      writeTargets,
      addToLabel,
      unresolvedLabel,
      valuePlaceholder,
      variableSuggestions = [],
      variableGroupLabels,
      className,
      disabled,
      onBlur,
      onFocus,
      onKeyDown,
      onSelect,
      onClick,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = React.useState(false)
    const [draft, setDraft] = React.useState(value)
    const areaRef = React.useRef<HTMLTextAreaElement>(null)
    const valueRef = React.useRef(value)
    const draftRef = React.useRef(draft)
    valueRef.current = value
    draftRef.current = draft
    React.useImperativeHandle(ref, () => areaRef.current as HTMLTextAreaElement)

    const showHighlight = !focused && !disabled && hasEnvTemplate(draft)
    const autocomplete = useEnvTemplateAutocomplete({
      value: draft,
      onChange: (next) => {
        setDraft(next)
        draftRef.current = next
      },
      suggestions: variableSuggestions,
      groupLabels: variableGroupLabels,
      enabled: !disabled && variableSuggestions.length > 0,
      inputRef: areaRef,
    })

    React.useEffect(() => {
      if (!focused) setDraft(value)
    }, [value, focused])

    const commitDraft = React.useCallback(() => {
      const next = draftRef.current
      if (next !== valueRef.current) onChange(next)
    }, [onChange])

    const startEdit = React.useCallback(() => {
      areaRef.current?.focus()
    }, [])

    return (
      <div className="relative w-full min-w-0">
        {showHighlight ? (
          <TemplatedValueDisplay
            value={draft}
            resolveVariable={resolveVariable}
            onVariableChange={onVariableChange}
            onManageVariables={onManageVariables}
            manageVariablesLabel={manageVariablesLabel}
            writeTargets={writeTargets}
            addToLabel={addToLabel}
            unresolvedLabel={unresolvedLabel}
            valuePlaceholder={valuePlaceholder}
            onStartEdit={startEdit}
            overlay
            multiline
            className="absolute inset-0 z-10"
            aria-label={props['aria-label']}
          />
        ) : null}
        <Textarea
          {...props}
          ref={areaRef}
          value={draft}
          disabled={disabled}
          className={cn(
            'font-mono',
            className,
            showHighlight && 'text-transparent caret-transparent selection:bg-transparent'
          )}
          onChange={(e) => {
            const next = e.target.value
            const cursor = e.target.selectionStart ?? next.length
            autocomplete.onValueChange(next, cursor)
          }}
          onClick={(e) => {
            autocomplete.syncCursor()
            onClick?.(e)
          }}
          onSelect={(e) => {
            autocomplete.syncCursor()
            onSelect?.(e)
          }}
          onKeyDown={(e) => {
            autocomplete.onKeyDown(e)
            if (!e.defaultPrevented) onKeyDown?.(e)
          }}
          onFocus={(e) => {
            setFocused(true)
            autocomplete.syncCursor()
            onFocus?.(e)
          }}
          onBlur={(e) => {
            autocomplete.onBlur()
            commitDraft()
            setFocused(false)
            onBlur?.(e)
          }}
          spellCheck={false}
        />
        {autocomplete.listProps ? <EnvTemplateSuggestList {...autocomplete.listProps} /> : null}
      </div>
    )
  }
)
TemplatedTextarea.displayName = 'TemplatedTextarea'
