import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import type { EnvVarLookup } from './env-template'
import { Input } from './input'
import { PasswordInput } from './password-input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export type EnvWriteTarget = {
  /** Scope id passed to `onVariableChange` (e.g. `global` | `profile` | `base`). */
  id: string
  label: string
  disabled?: boolean
}

export type EnvVariableChangeHandler = (key: string, value: string, scope?: string) => void

export type EnvVariableChipProps = {
  /** Display text inside the chip (usually `{{key}}`). */
  raw: string
  variableKey: string
  lookup: EnvVarLookup | null
  onVariableChange: EnvVariableChangeHandler
  onManageVariables?: () => void
  manageVariablesLabel?: string
  /** When unresolved, offer these scopes for “Add to”. */
  writeTargets?: readonly EnvWriteTarget[]
  addToLabel?: string
  unresolvedLabel?: string
  valuePlaceholder?: string
  /**
   * Allow the chip label to wrap (textarea / multiline preview).
   * Default truncates so single-line fields stay one row.
   */
  wrap?: boolean
  className?: string
}

export function EnvVariableChip({
  raw,
  variableKey,
  lookup,
  onVariableChange,
  onManageVariables,
  manageVariablesLabel = 'Manage variables',
  writeTargets,
  addToLabel = 'Add to',
  unresolvedLabel = 'Unresolved',
  valuePlaceholder = 'Enter value',
  wrap = false,
  className,
}: EnvVariableChipProps) {
  const unresolved = !lookup || lookup.unresolved
  const dynamic = lookup?.dynamic === true
  const secret = lookup?.secret === true
  const canManageVariable = Boolean(onManageVariables) && !dynamic
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(lookup?.value ?? '')

  const enabledTargets = React.useMemo(
    () => (writeTargets ?? []).filter((target) => !target.disabled),
    [writeTargets]
  )

  const defaultTargetId = React.useMemo(() => {
    const preferred = ['base', 'profile', 'global']
    for (const id of preferred) {
      if (enabledTargets.some((target) => target.id === id)) return id
    }
    return enabledTargets[0]?.id
  }, [enabledTargets])

  const [writeTargetId, setWriteTargetId] = React.useState<string | undefined>(defaultTargetId)

  React.useEffect(() => {
    if (open) setDraft(lookup?.value ?? '')
  }, [open, lookup?.value])

  React.useEffect(() => {
    if (!writeTargetId || !enabledTargets.some((target) => target.id === writeTargetId)) {
      setWriteTargetId(defaultTargetId)
    }
  }, [defaultTargetId, enabledTargets, writeTargetId])

  const selectedTarget =
    enabledTargets.find((target) => target.id === writeTargetId) ?? enabledTargets[0]

  const commit = (scope = unresolved ? selectedTarget?.id : undefined) => {
    if (dynamic) return
    if (unresolved && !draft.trim()) return
    if (unresolved && !scope) return
    onVariableChange(variableKey, draft, scope)
  }

  const showWritePicker = unresolved && !dynamic && (writeTargets?.length ?? 0) > 0

  const manageVariables = () => {
    setOpen(false)
    onManageVariables?.()
    window.requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"][data-state="open"]')) return
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && open && unresolved && !dynamic) {
      commit()
    }
    setOpen(next)
  }

  const valueFieldProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (dynamic) return
      setDraft(e.target.value)
    },
    onBlur: () => {
      if (dynamic) return
      if (!showWritePicker) commit()
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!dynamic) commit()
        setOpen(false)
      }
    },
    readOnly: dynamic,
    className: cn('h-7 font-mono text-xs', dynamic && 'text-muted-foreground'),
    placeholder: unresolved ? valuePlaceholder : undefined,
  } as const

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className={cn(
            'env-var-chip max-w-full rounded-xs px-0.5 font-mono text-[1em]',
            wrap
              ? // inline-block keeps the chip in the textarea text flow (no flex gaps).
                'inline-block whitespace-pre-wrap break-all px-0.5 py-0 align-baseline leading-[inherit]'
              : 'inline-flex items-center self-center truncate py-px leading-none',
            unresolved
              ? 'bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px] shadow-destructive/60'
              : 'bg-sky-400/10 text-sky-400 shadow-[inset_0_0_0_1px] shadow-sky-400/70',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {raw}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 space-y-2 p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        {secret ? <PasswordInput {...valueFieldProps} /> : <Input {...valueFieldProps} />}
        <div className="flex items-center justify-between gap-2">
          {showWritePicker ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="min-w-0 max-w-[60%] justify-start px-1.5 text-muted-foreground"
                  aria-label={`${addToLabel} ${selectedTarget?.label ?? unresolvedLabel}`}
                >
                  <span className="shrink-0">{addToLabel}</span>
                  <span className="truncate font-medium text-foreground">
                    {selectedTarget?.label ?? unresolvedLabel}
                  </span>
                  <ChevronDown className="opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36">
                {(writeTargets ?? []).map((target) => {
                  const selected = target.id === selectedTarget?.id
                  return (
                    <DropdownMenuItem
                      key={target.id}
                      disabled={target.disabled}
                      className="gap-2"
                      onSelect={() => {
                        if (target.disabled) return
                        setWriteTargetId(target.id)
                      }}
                    >
                      <Check
                        className={cn('size-3.5 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                        aria-hidden
                      />
                      {target.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1.5 px-1.5 text-muted-foreground text-xs">
              <span
                className="inline-block size-3 shrink-0 rounded-sm border border-border"
                style={{
                  backgroundColor: lookup?.scopeColor || (unresolved ? 'transparent' : undefined),
                }}
                aria-hidden
              />
              <span className="truncate">
                {unresolved ? unresolvedLabel : (lookup?.scopeLabel ?? '')}
              </span>
            </span>
          )}
          {canManageVariable ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-6 shrink-0 px-1.5"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                manageVariables()
              }}
              onClick={(event) => {
                if (event.detail !== 0) return
                event.preventDefault()
                event.stopPropagation()
                manageVariables()
              }}
            >
              {manageVariablesLabel}
              <span aria-hidden>→</span>
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
