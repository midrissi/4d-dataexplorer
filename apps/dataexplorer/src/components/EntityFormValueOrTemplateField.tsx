import { dateValueToInputValue } from '@4d/rest'
import {
  DatePicker,
  Input,
  Label,
  SegmentedControl,
  type SegmentedControlOption,
  TemplatedTextInput,
  type TemplatedTextInputProps,
} from '@4d/ui'
import { Braces, CalendarDays, Hash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getIntlLocale, useTranslation } from '~/i18n'
import {
  isNumberAttrType,
  stringHasEnvTemplate,
  toDateOnlyString,
} from '~/lib/env/coerce-entity-data'

type FieldMode = 'value' | 'template'

type EnvFieldProps = Pick<
  TemplatedTextInputProps,
  | 'resolveVariable'
  | 'onVariableChange'
  | 'onManageVariables'
  | 'manageVariablesLabel'
  | 'writeTargets'
  | 'addToLabel'
  | 'unresolvedLabel'
  | 'valuePlaceholder'
  | 'variableSuggestions'
  | 'variableGroupLabels'
>

function initialMode(fieldValue: unknown): FieldMode {
  return typeof fieldValue === 'string' && stringHasEnvTemplate(fieldValue) ? 'template' : 'value'
}

function dateDisplayValue(fieldValue: unknown): string {
  if (fieldValue != null && typeof fieldValue === 'string' && stringHasEnvTemplate(fieldValue)) {
    return fieldValue
  }
  return dateValueToInputValue(fieldValue) || (fieldValue != null ? String(fieldValue) : '')
}

function numberDisplayValue(fieldValue: unknown): string {
  return fieldValue != null ? String(fieldValue) : ''
}

function toPickerDateValue(fieldValue: unknown): string {
  if (fieldValue == null) return ''
  if (typeof fieldValue === 'string') {
    if (stringHasEnvTemplate(fieldValue)) return ''
    return toDateOnlyString(fieldValue) ?? dateValueToInputValue(fieldValue)
  }
  return dateValueToInputValue(fieldValue)
}

function toPickerNumberValue(fieldValue: unknown): string {
  if (fieldValue == null) return ''
  if (typeof fieldValue === 'string' && stringHasEnvTemplate(fieldValue)) return ''
  const num = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue)
  return Number.isFinite(num) ? String(num) : ''
}

export function EntityFormValueOrTemplateField({
  attrName,
  attrType,
  fieldId,
  fieldValue,
  onFieldChange,
  envField,
}: {
  attrName: string
  attrType: string
  fieldId: string
  fieldValue: unknown
  onFieldChange: (field: string, value: unknown) => void
  envField: EnvFieldProps
}) {
  const { t, language } = useTranslation()
  const kind = isNumberAttrType(attrType) ? 'number' : 'date'
  const [mode, setMode] = useState<FieldMode>(() => initialMode(fieldValue))

  const datePickerLabels = useMemo(
    () => ({
      placeholder: t('entity.datePickerPlaceholder'),
      clear: t('entity.datePickerClear'),
      today: t('entity.datePickerToday'),
      previousMonth: t('entity.datePickerPreviousMonth'),
      nextMonth: t('entity.datePickerNextMonth'),
      month: t('entity.datePickerMonth'),
      year: t('entity.datePickerYear'),
      openCalendar: t('entity.datePickerOpen', { field: attrName }),
    }),
    [attrName, t]
  )

  const modeOptions = useMemo((): SegmentedControlOption<FieldMode>[] => {
    if (kind === 'date') {
      return [
        {
          value: 'value',
          label: t('entity.fieldModeDate'),
          icon: CalendarDays,
          ariaLabel: t('entity.fieldModeDateAria', { field: attrName }),
        },
        {
          value: 'template',
          label: t('entity.fieldModeTemplate'),
          icon: Braces,
          ariaLabel: t('entity.fieldModeTemplateAria', { field: attrName }),
        },
      ]
    }
    return [
      {
        value: 'value',
        label: t('entity.fieldModeNumber'),
        icon: Hash,
        ariaLabel: t('entity.fieldModeNumberAria', { field: attrName }),
      },
      {
        value: 'template',
        label: t('entity.fieldModeTemplate'),
        icon: Braces,
        ariaLabel: t('entity.fieldModeTemplateAria', { field: attrName }),
      },
    ]
  }, [attrName, kind, t])

  const handleModeChange = (next: FieldMode) => {
    if (next === mode) return
    if (next === 'value') {
      if (kind === 'date') {
        onFieldChange(attrName, toPickerDateValue(fieldValue) || null)
      } else {
        const raw = toPickerNumberValue(fieldValue)
        onFieldChange(attrName, raw === '' ? null : raw)
      }
    } else {
      const asText = kind === 'date' ? dateDisplayValue(fieldValue) : numberDisplayValue(fieldValue)
      onFieldChange(attrName, asText === '' ? null : asText)
    }
    setMode(next)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId} className="text-sm">
          {attrName}
        </Label>
        <SegmentedControl
          value={mode}
          options={modeOptions}
          onValueChange={handleModeChange}
          aria-label={t('entity.fieldModeGroupAria', { field: attrName })}
        />
      </div>
      {mode === 'template' ? (
        <TemplatedTextInput
          id={fieldId}
          inputMode={kind === 'number' ? 'decimal' : undefined}
          placeholder={
            kind === 'date'
              ? t('entity.dateOrTemplatePlaceholder')
              : t('entity.numberOrTemplatePlaceholder')
          }
          value={kind === 'date' ? dateDisplayValue(fieldValue) : numberDisplayValue(fieldValue)}
          onChange={(value) => onFieldChange(attrName, value === '' ? null : value)}
          {...envField}
        />
      ) : kind === 'date' ? (
        <DatePicker
          id={fieldId}
          value={toPickerDateValue(fieldValue) || null}
          onChange={(next) => onFieldChange(attrName, next)}
          locale={getIntlLocale(language)}
          labels={datePickerLabels}
          aria-label={attrName}
        />
      ) : (
        <Input
          id={fieldId}
          type="number"
          inputMode="decimal"
          value={toPickerNumberValue(fieldValue)}
          onChange={(e) => {
            const raw = e.target.value
            onFieldChange(attrName, raw === '' ? null : raw)
          }}
        />
      )}
    </div>
  )
}
