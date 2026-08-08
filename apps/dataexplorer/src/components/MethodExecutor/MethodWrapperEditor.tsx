import { Checkbox, Label } from '@4d/ui'
import { useCallback, useRef } from 'react'
import { useTranslation } from '~/i18n'
import { MethodJsonEditor } from './MethodJsonEditor'
import { METHOD_WRAPPER_SNIPPETS } from './method-json-snippets'

type WrapperFlush = () => string
const pendingWrapperFlushes = new Set<WrapperFlush>()

function normalizeWrapperText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '{}' || trimmed === '{\n  \n}') return ''
  return text
}

/**
 * Push in-progress wrapper draft to parent state and return the normalized text
 * (call before Execute so Cmd/Ctrl+Enter sees the latest draft).
 */
export function flushPendingWrapperText(): string | undefined {
  let latest: string | undefined
  for (const flush of [...pendingWrapperFlushes]) {
    latest = flush()
  }
  return latest
}

/**
 * Optional JSON object editor for the REST function-call wrapper.
 * When enabled, POST body becomes `{ params: [...], ...wrapper }`.
 */
export function MethodWrapperEditor({
  enabled,
  onEnabledChange,
  value,
  onChange,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const onRegisterFlush = useCallback((flush: () => string) => {
    const wrapped = () => {
      const next = normalizeWrapperText(flush())
      if (next !== (valueRef.current || '')) {
        onChangeRef.current(next)
      }
      return next
    }
    pendingWrapperFlushes.add(wrapped)
    return () => {
      pendingWrapperFlushes.delete(wrapped)
      wrapped()
    }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label className="flex items-center gap-2 font-medium text-sm">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => onEnabledChange(checked === true)}
            />
            {t('methodExecutor.wrapper')}
          </Label>
          <p className="mt-0.5 pl-6 text-muted-foreground text-xs">
            {t('methodExecutor.wrapperHint')}
          </p>
        </div>
      </div>

      {enabled ? (
        <MethodJsonEditor
          value={value || '{\n  \n}'}
          onChange={(next) => onChange(normalizeWrapperText(next))}
          height={160}
          path="method-executor:///wrapper.json"
          snippets={METHOD_WRAPPER_SNIPPETS}
          onRegisterFlush={onRegisterFlush}
        />
      ) : null}
    </div>
  )
}
