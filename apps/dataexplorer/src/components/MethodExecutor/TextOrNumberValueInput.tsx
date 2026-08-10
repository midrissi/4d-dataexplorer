import { Input, TemplatedValueDisplay, cn } from '@4d/ui'
import { useEffect, useRef, useState } from 'react'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { ARG_INPUT_ATTR } from './arg-input'
import { useUncontrolledCommit } from './use-uncontrolled-commit'

function hasEnvTemplate(value: string): boolean {
  return value.includes('{{') && value.includes('}}')
}

export function TextOrNumberValueInput({
  argument,
  typeLabel,
  argumentName,
  inputId,
  onChange,
}: {
  argument: Extract<RuntimeArgument, { kind: 'string' | 'number' }>
  typeLabel: string
  argumentName: string
  inputId: string
  onChange: (argument: RuntimeArgument) => void
}) {
  const { t } = useTranslation()
  const envField = useTemplatedEnvFieldProps()
  const label = argument.kind === 'number' ? t('methodExecutor.number') : t('methodExecutor.string')
  const argumentRef = useRef(argument)
  argumentRef.current = argument
  const [editing, setEditing] = useState(false)
  const { inputRef, flush, onInput, onKeyDown } = useUncontrolledCommit(argument.value, (value) => {
    onChange({ ...argumentRef.current, value })
  })

  const inputClassName =
    'h-6 min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0 md:text-xs'

  const showHighlight = argument.kind === 'string' && !editing && hasEnvTemplate(argument.value)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing, inputRef])

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
      <label htmlFor={inputId} className="sr-only">
        {`${label}: ${argumentName}`}
      </label>
      {showHighlight ? (
        <TemplatedValueDisplay
          value={argument.value}
          resolveVariable={envField.resolveVariable}
          onVariableChange={envField.onVariableChange}
          onManageVariables={envField.onManageVariables}
          manageVariablesLabel={envField.manageVariablesLabel}
          writeTargets={envField.writeTargets}
          addToLabel={envField.addToLabel}
          unresolvedLabel={envField.unresolvedLabel}
          valuePlaceholder={envField.valuePlaceholder}
          aria-label={`${label}: ${argumentName}`}
          onStartEdit={() => setEditing(true)}
          className={cn(
            inputClassName,
            // Flat arg row: strip the default Input chrome from TemplatedValueDisplay.
            'min-h-6 items-center py-0 leading-none'
          )}
        />
      ) : (
        <Input
          ref={inputRef}
          id={inputId}
          name={`method-argument-${argument.id}-value`}
          type={argument.kind === 'number' ? 'number' : 'text'}
          defaultValue={argument.value}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            flush()
            setEditing(false)
          }}
          onInput={onInput}
          onKeyDown={onKeyDown}
          data-param-name={argument.name}
          {...{ [ARG_INPUT_ATTR]: '' }}
          placeholder={
            argument.kind === 'string' ? t('methodExecutor.stringPlaceholder') : undefined
          }
          className={inputClassName}
          spellCheck={false}
          autoComplete="off"
        />
      )}
    </div>
  )
}
