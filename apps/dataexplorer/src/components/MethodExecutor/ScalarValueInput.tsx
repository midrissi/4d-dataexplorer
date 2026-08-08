import { Switch } from '@4d/ui'
import { useId } from 'react'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { ARG_INPUT_ATTR, handleArgInputTabNavigation } from './arg-input'
import { DateArgumentPicker } from './DateArgumentPicker'
import { TextOrNumberValueInput } from './TextOrNumberValueInput'

export function ScalarValueInput({
  argument,
  onChange,
}: {
  argument: Extract<RuntimeArgument, { kind: 'string' | 'number' | 'boolean' | 'date' }>
  onChange: (argument: RuntimeArgument) => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const argumentName = argument.name ?? t('methodExecutor.argument')
  const typeLabel = argument.sourceType ?? argument.kind

  if (argument.kind === 'boolean') {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
        <Switch
          id={inputId}
          checked={argument.value}
          onCheckedChange={(checked) => onChange({ ...argument, value: checked })}
          aria-label={`${t('methodExecutor.boolean')}: ${argumentName}`}
        />
        <span className="font-mono text-xs tabular-nums" translate="no">
          {argument.value ? 'true' : 'false'}
        </span>
      </div>
    )
  }

  if (argument.kind === 'date') {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
        <DateArgumentPicker
          id={inputId}
          name={`method-argument-${argument.id}-value`}
          value={argument.value}
          label={`${t('methodExecutor.date')}: ${argumentName}`}
          onChange={(value) => onChange({ ...argument, value })}
          onKeyDown={handleArgInputTabNavigation}
          {...{ [ARG_INPUT_ATTR]: '' }}
        />
      </div>
    )
  }

  return (
    <TextOrNumberValueInput
      key={`${argument.id}-${argument.kind}`}
      argument={argument}
      typeLabel={typeLabel}
      argumentName={argumentName}
      inputId={inputId}
      onChange={onChange}
    />
  )
}
