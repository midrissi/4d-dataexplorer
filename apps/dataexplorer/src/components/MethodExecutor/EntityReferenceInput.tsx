import { useId } from 'react'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { AutoSizeKeyInput } from './AutoSizeKeyInput'
import { ARG_INPUT_ATTR, handleArgInputTabNavigation } from './arg-input'
import { EntitySelectionKeyInput } from './EntitySelectionKeyInput'
import { SearchableDataclassSelect } from './SearchableDataclassSelect'

type EntityReferenceArgument = Extract<RuntimeArgument, { kind: 'entity' | 'entitysel' }>

export function EntityReferenceInput({
  argument,
  dataClasses,
  onChange,
}: {
  argument: EntityReferenceArgument
  dataClasses: string[]
  onChange: (argument: RuntimeArgument) => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const isEntity = argument.kind === 'entity'
  const argumentName = argument.name ?? t('methodExecutor.argument')
  const keyLabel = isEntity ? t('methodExecutor.entityKey') : t('methodExecutor.entitySelectionKey')
  const value = isEntity ? argument.key : argument.entitySetId

  const setKey = (nextValue: string) => {
    if (argument.kind === 'entity') {
      onChange({ ...argument, key: nextValue })
    } else {
      onChange({ ...argument, entitySetId: nextValue })
    }
  }

  return (
    <code className="inline-flex min-w-max max-w-none flex-nowrap items-center gap-x-0 whitespace-nowrap font-mono text-xs leading-5">
      <span className="text-sky-600 dark:text-sky-400" translate="no" aria-hidden="true">
        ds
      </span>
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        .
      </span>
      <SearchableDataclassSelect
        value={argument.dataClass}
        dataClasses={dataClasses}
        argumentName={argumentName}
        onChange={(dataClass) => onChange({ ...argument, dataClass })}
      />
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        .
      </span>
      <span className="text-amber-600 dark:text-amber-400" translate="no" aria-hidden="true">
        {isEntity ? 'entity' : 'sel'}
      </span>
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        (
      </span>
      {isEntity ? (
        <AutoSizeKeyInput
          id={inputId}
          name={`method-argument-${argument.id}-key`}
          value={value}
          label={`${keyLabel}: ${argumentName}`}
          onChange={setKey}
        />
      ) : (
        <EntitySelectionKeyInput
          id={inputId}
          name={`method-argument-${argument.id}-key`}
          value={value}
          label={`${keyLabel}: ${argumentName}`}
          dataClass={argument.dataClass}
          onChange={setKey}
          onKeyDown={handleArgInputTabNavigation}
          {...{ [ARG_INPUT_ATTR]: '' }}
        />
      )}
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        )
      </span>
    </code>
  )
}
