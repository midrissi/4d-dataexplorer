import { Button, cn, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { TextCursorInput, WandSparkles } from 'lucide-react'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { SuggestInput } from '~/components/SuggestInput'
import { useTranslation } from '~/i18n'
import type { RestParamValueKind } from '~/lib/http-client'
import { ListTagsInput } from './ListTagsInput'

const valueInputClassName =
  'h-6 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0'

/**
 * Smart value cell for REST query params: enum autocomplete, number, or tags —
 * with an optional override back to free text + autocomplete.
 */
export function ParamValueField({
  paramKey,
  kind,
  value,
  onChange,
  placeholder,
  suggestions,
  thisRoot,
  forceText,
  onForceTextChange,
}: {
  paramKey: string
  kind: RestParamValueKind
  value: string
  onChange: (value: string) => void
  placeholder: string
  suggestions: readonly string[]
  thisRoot?: unknown
  forceText: boolean
  onForceTextChange: (forceText: boolean) => void
}) {
  const { t } = useTranslation()
  const envField = useTemplatedEnvFieldProps({ thisRoot })
  const useSmart = !forceText && kind !== 'text'
  const showToggle = kind !== 'text'

  const textField = (
    <SuggestInput
      value={value}
      onChange={onChange}
      suggestions={suggestions}
      filter="includes"
      placeholder={placeholder}
      className="h-full w-full"
      inputClassName={valueInputClassName}
      minListWidth={180}
      {...envField}
    />
  )

  let body = textField
  if (useSmart && kind === 'number') {
    body = (
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={valueInputClassName}
        aria-label={t('httpClient.paramValueNumber', { key: paramKey || t('httpClient.value') })}
      />
    )
  } else if (useSmart && kind === 'list') {
    body = (
      <ListTagsInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={t('httpClient.paramValueList', { key: paramKey || t('httpClient.value') })}
      />
    )
  } else if (useSmart && kind === 'enum') {
    body = (
      <SuggestInput
        value={value}
        onChange={onChange}
        suggestions={suggestions}
        filter="includes"
        placeholder={placeholder}
        className="h-full w-full"
        inputClassName={valueInputClassName}
        minListWidth={180}
        {...envField}
      />
    )
  }

  return (
    <div className="flex w-full min-w-0 items-stretch">
      <div className="min-w-0 flex-1">{body}</div>
      {showToggle ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'ml-auto h-6 w-6 shrink-0 self-center rounded-none text-muted-foreground hover:text-foreground',
                  forceText && 'text-foreground'
                )}
                aria-pressed={forceText}
                aria-label={
                  forceText ? t('httpClient.useSmartParamValue') : t('httpClient.useTextParamValue')
                }
                onClick={() => onForceTextChange(!forceText)}
              >
                {forceText ? (
                  <WandSparkles className="h-3 w-3" />
                ) : (
                  <TextCursorInput className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {forceText ? t('httpClient.useSmartParamValue') : t('httpClient.useTextParamValue')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  )
}
