import { Button, cn, Input } from '@4d/ui'
import { Radar, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { eventToShortcutSearchCombo } from '~/lib/shortcut-search'
import { formatKeyCombo, type KeyCombo } from '~/store/settings'

type ShortcutFinderProps = {
  query: string
  recordedCombo: KeyCombo | null
  resultCount: number
  totalCount: number
  onTextChange: (value: string) => void
  onRecord: (combo: KeyCombo, displayValue: string) => void
  onClear: () => void
}

export function ShortcutFinder({
  query,
  recordedCombo,
  resultCount,
  totalCount,
  onTextChange,
  onRecord,
  onClear,
}: ShortcutFinderProps) {
  const { t } = useTranslation()
  const [listening, setListening] = useState(false)
  const listenButtonRef = useRef<HTMLButtonElement>(null)

  const stopListening = useCallback(() => {
    setListening(false)
    listenButtonRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!listening) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      if (event.key === 'Escape') {
        stopListening()
        return
      }

      const combo = eventToShortcutSearchCombo(event)
      if (!combo) return
      onRecord(combo, formatKeyCombo(combo))
      stopListening()
    },
    [listening, onRecord, stopListening]
  )

  useEffect(() => {
    if (!listening) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown, listening])

  const hasFilter = query.trim().length > 0 || recordedCombo !== null

  return (
    <search
      aria-label={t('settings.shortcutFinderLabel')}
      className={cn(
        'mb-3 rounded-lg border p-3 transition-colors',
        listening ? 'border-primary/60 bg-primary/5' : 'border-border bg-muted/20'
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            listening ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <Radar className={cn('h-4 w-4', listening && 'animate-pulse')} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm">{t('settings.shortcutFinderTitle')}</h3>
          <p className="text-muted-foreground text-xs">
            {listening
              ? t('settings.shortcutFinderListening')
              : t('settings.shortcutFinderDescription')}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={t('settings.shortcutFinderPlaceholder')}
            className="h-8 pr-8 pl-8 text-sm"
            aria-label={t('settings.shortcutFinderInputLabel')}
          />
          {hasFilter ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0"
              onClick={onClear}
              aria-label={t('settings.shortcutFinderClear')}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
        <Button
          ref={listenButtonRef}
          type="button"
          variant={listening ? 'secondary' : 'outline'}
          size="sm"
          className={cn('h-8 shrink-0 gap-1.5 px-3', listening && 'ring-2 ring-primary/30')}
          onClick={() => setListening((current) => !current)}
          onBlur={() => setListening(false)}
          aria-pressed={listening}
          data-allow-typing={listening ? '' : undefined}
        >
          <Radar className="h-3.5 w-3.5" aria-hidden />
          {listening ? t('settings.shortcutFinderCancel') : t('settings.shortcutFinderRecord')}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
        {hasFilter
          ? t('settings.shortcutFinderResults', { count: resultCount })
          : t('settings.shortcutFinderAll', { count: totalCount })}
      </p>
    </search>
  )
}
