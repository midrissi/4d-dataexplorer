import { cn, Input, TemplatedTextInput } from '@4d/ui'
import { useRef } from 'react'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { ARG_INPUT_ATTR } from './arg-input'
import { useUncontrolledCommit } from './use-uncontrolled-commit'

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
  const { inputRef, flush, onInput, onKeyDown } = useUncontrolledCommit(argument.value, (value) => {
    onChange({ ...argumentRef.current, value })
  })

  const inputClassName =
    'h-6 min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0 md:text-xs'

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
      <label htmlFor={inputId} className="sr-only">
        {`${label}: ${argumentName}`}
      </label>
      {argument.kind === 'string' ? (
        <TemplatedTextInput
          id={inputId}
          name={`method-argument-${argument.id}-value`}
          value={argument.value}
          onChange={(value) => onChange({ ...argumentRef.current, value })}
          aria-label={`${label}: ${argumentName}`}
          data-param-name={argument.name}
          {...{ [ARG_INPUT_ATTR]: '' }}
          placeholder={t('methodExecutor.stringPlaceholder')}
          className={cn(inputClassName, 'min-h-6 items-center py-0 leading-none')}
          spellCheck={false}
          {...envField}
        />
      ) : (
        <Input
          ref={inputRef}
          id={inputId}
          name={`method-argument-${argument.id}-value`}
          type="number"
          defaultValue={argument.value}
          onBlur={flush}
          onInput={onInput}
          onKeyDown={onKeyDown}
          data-param-name={argument.name}
          {...{ [ARG_INPUT_ATTR]: '' }}
          className={inputClassName}
          spellCheck={false}
          autoComplete="off"
        />
      )}
    </div>
  )
}
