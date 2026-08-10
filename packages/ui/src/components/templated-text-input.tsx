import * as React from 'react'
import { cn } from '../lib/utils'
import { type EnvVarLookup, parseEnvTemplateSegments } from './env-template'
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
}: TemplatedValueDisplayProps) {
  const segments = React.useMemo(() => parseEnvTemplateSegments(value), [value])

  return (
    // biome-ignore lint/a11y/useSemanticElements: chip preview surface; focuses a real <input> on edit
    <div
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-7 w-full min-w-0 cursor-text flex-wrap items-center gap-y-0 overflow-x-auto rounded-sm border border-input bg-background px-2.5 py-0 font-mono text-foreground text-sm leading-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
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
      {segments.map((segment) => {
        if (segment.kind === 'text') {
          return (
            <span
              key={`t-${segment.offset}`}
              className="inline-flex items-center whitespace-pre leading-none"
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
          />
        )
      })}
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
      className,
      disabled,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const [editing, setEditing] = React.useState(false)
    const [draft, setDraft] = React.useState(value)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const valueRef = React.useRef(value)
    const draftRef = React.useRef(draft)
    valueRef.current = value
    draftRef.current = draft
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const showHighlight = !editing && !disabled && hasEnvTemplate(value)

    React.useEffect(() => {
      if (!editing) setDraft(value)
    }, [value, editing])

    React.useEffect(() => {
      if (editing) inputRef.current?.focus()
    }, [editing])

    const commitDraft = React.useCallback(() => {
      const next = draftRef.current
      if (next !== valueRef.current) onChange(next)
    }, [onChange])

    if (showHighlight) {
      return (
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
          onStartEdit={() => {
            setDraft(value)
            setEditing(true)
          }}
          className={className}
          aria-label={props['aria-label']}
        />
      )
    }

    return (
      <Input
        ref={inputRef}
        value={draft}
        disabled={disabled}
        className={cn('font-mono', className)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setEditing(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          commitDraft()
          setEditing(false)
          onBlur?.(e)
        }}
        {...props}
      />
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
      className,
      disabled,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const [editing, setEditing] = React.useState(false)
    const [draft, setDraft] = React.useState(value)
    const areaRef = React.useRef<HTMLTextAreaElement>(null)
    const valueRef = React.useRef(value)
    const draftRef = React.useRef(draft)
    valueRef.current = value
    draftRef.current = draft
    React.useImperativeHandle(ref, () => areaRef.current as HTMLTextAreaElement)

    const showHighlight = !editing && !disabled && hasEnvTemplate(value)

    React.useEffect(() => {
      if (!editing) setDraft(value)
    }, [value, editing])

    React.useEffect(() => {
      if (editing) areaRef.current?.focus()
    }, [editing])

    const commitDraft = React.useCallback(() => {
      const next = draftRef.current
      if (next !== valueRef.current) onChange(next)
    }, [onChange])

    if (showHighlight) {
      return (
        <div className={cn('min-h-[4.5rem]', className)}>
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
            onStartEdit={() => {
              setDraft(value)
              setEditing(true)
            }}
            aria-label={props['aria-label']}
          />
        </div>
      )
    }

    return (
      <Textarea
        ref={areaRef}
        value={draft}
        disabled={disabled}
        className={cn('font-mono', className)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setEditing(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          commitDraft()
          setEditing(false)
          onBlur?.(e)
        }}
        {...props}
      />
    )
  }
)
TemplatedTextarea.displayName = 'TemplatedTextarea'
