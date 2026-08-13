import { Checkbox, cn, Label } from '@4d/ui'
import { Braces } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from '~/i18n'
import { MethodJsonEditor } from './MethodJsonEditor'
import { MethodSnippetsMenu } from './MethodSnippetsMenu'
import { DEFAULT_METHOD_WRAPPER_TEXT, METHOD_WRAPPER_SNIPPETS } from './method-json-snippets'

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
    <div
      className={cn(
        'border-border/50 border-b transition-colors',
        enabled ? 'bg-primary/5' : 'hover:bg-muted/25'
      )}
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        <Checkbox
          id="method-wrapper-enabled"
          className="mt-0.5"
          checked={enabled}
          onCheckedChange={(checked) => {
            const next = checked === true
            if (next && !valueRef.current.trim()) {
              onChange(DEFAULT_METHOD_WRAPPER_TEXT)
            }
            onEnabledChange(next)
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="method-wrapper-enabled"
              className="flex cursor-pointer items-center gap-1.5 font-medium text-xs"
            >
              <Braces className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {t('methodExecutor.wrapper')}
            </Label>
            {enabled ? (
              <MethodSnippetsMenu
                snippets={METHOD_WRAPPER_SNIPPETS}
                onApply={(snippet) => onChange(normalizeWrapperText(snippet.value))}
              />
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
            {t('methodExecutor.wrapperHint')}
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="border-border/40 border-t px-2 pt-1.5 pb-2">
          <MethodJsonEditor
            value={value.trim() ? value : DEFAULT_METHOD_WRAPPER_TEXT}
            onChange={(next) => onChange(normalizeWrapperText(next))}
            height={120}
            path="method-executor:///wrapper.json"
            onRegisterFlush={onRegisterFlush}
          />
        </div>
      ) : null}
    </div>
  )
}
