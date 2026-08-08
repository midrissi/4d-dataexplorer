import { Input } from '@4d/ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { durationValueToInputValue, parseDurationInput } from '~/lib/duration'

export function FormViewDurationField({
  attr,
  value,
  onFieldChange,
  fieldId,
  isReadonly,
}: {
  attr: { name: string }
  value: unknown
  onFieldChange: (field: string, value: number | null) => void
  fieldId: string
  isReadonly: boolean
}) {
  const { t } = useTranslation()
  const formatted = durationValueToInputValue(value)
  const [rawString, setRawString] = useState(formatted)
  const lastPushedRef = useRef<number | null>(null)

  useEffect(() => {
    const same =
      (value == null && lastPushedRef.current == null) ||
      (typeof value === 'number' && value === lastPushedRef.current)
    if (same) return
    lastPushedRef.current = typeof value === 'number' && !Number.isNaN(value) ? value : null
    setRawString(durationValueToInputValue(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setRawString(next)
    const parsed = parseDurationInput(next)
    if (parsed !== null) {
      lastPushedRef.current = parsed
      onFieldChange(attr.name, parsed)
      // Do not setRawString(formatted) here: it overwrites the user's input while typing.
      // Sync from props happens in useEffect.
    } else {
      lastPushedRef.current = null
      onFieldChange(attr.name, null)
    }
  }

  const handleBlur = () => {
    setRawString(durationValueToInputValue(value))
  }

  return (
    <Input
      id={fieldId}
      type="text"
      value={rawString}
      onChange={handleChange}
      onBlur={handleBlur}
      readOnly={isReadonly}
      disabled={isReadonly}
      placeholder={t('entity.durationPlaceholder')}
    />
  )
}
