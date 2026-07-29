import { Button, cn, Input, Label } from '@4d/ui'
import { Clock3, Globe2, Sparkles, Wifi } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  applyServerUrlPort,
  applyServerUrlScheme,
  buildServerUrlSuggestions,
  SERVER_URL_PORTS,
  type ServerUrlSuggestion,
  type ServerUrlSuggestionKind,
} from '~mobile/lib/server-url-suggestions'

type MobileServerUrlFieldProps = {
  id?: string
  value: string
  recentUrls?: string[]
  onChange: (value: string) => void
}

function kindIcon(kind: ServerUrlSuggestionKind) {
  if (kind === 'recent') return Clock3
  if (kind === 'complete') return Sparkles
  return Globe2
}

export function MobileServerUrlField({
  id,
  value,
  recentUrls = [],
  onChange,
}: MobileServerUrlFieldProps) {
  const { t } = useTranslation()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const suggestions = useMemo(
    () => buildServerUrlSuggestions(value, recentUrls),
    [value, recentUrls]
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const selectSuggestion = (suggestion: ServerUrlSuggestion) => {
    onChange(suggestion.url)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      setActiveIndex(0)
      return
    }
    if (!open || suggestions.length === 0) {
      if (event.key === 'Escape') setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      const active = suggestions[activeIndex]
      if (active) {
        event.preventDefault()
        selectSuggestion(active)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const kindLabel = (kind: ServerUrlSuggestionKind) => {
    if (kind === 'recent') return t('mobile.urlSuggestRecent')
    if (kind === 'complete') return t('mobile.urlSuggestComplete')
    return t('mobile.urlSuggestPreset')
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <Label htmlFor={id}>{t('connectionScreen.formUrlLabel')}</Label>
      <div className="space-y-2">
        <div className="relative">
          <Wifi
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={id}
            className="h-11 pr-3 pl-10 text-base"
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setActiveIndex(0)
              setOpen(true)
            }}
            onFocus={() => {
              setActiveIndex(0)
              setOpen(true)
            }}
            onKeyDown={onKeyDown}
            placeholder="https://192.168.1.10:8080"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && suggestions[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined
            }
          />
        </div>

        {open && suggestions.length > 0 ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label={t('mobile.urlSuggestListAria')}
            className="max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-md"
          >
            {suggestions.map((suggestion, index) => {
              const Icon = kindIcon(suggestion.kind)
              const active = index === activeIndex
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                    active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                      suggestion.kind === 'recent'
                        ? 'border-primary/25 bg-primary/10 text-primary'
                        : suggestion.kind === 'complete'
                          ? 'border-warning/30 bg-warning/10 text-warning'
                          : 'border-border bg-muted/50 text-muted-foreground'
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">{suggestion.title}</span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {kindLabel(suggestion.kind)}
                      {suggestion.subtitle ? ` · ${suggestion.subtitle}` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {t('mobile.urlBuilderLabel')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs"
            onClick={() => {
              onChange(applyServerUrlScheme(value, 'http'))
              setOpen(true)
            }}
          >
            http://
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs"
            onClick={() => {
              onChange(applyServerUrlScheme(value, 'https'))
              setOpen(true)
            }}
          >
            https://
          </Button>
          <span className="mx-0.5 self-center text-border" aria-hidden>
            |
          </span>
          {SERVER_URL_PORTS.map((port) => (
            <Button
              key={port}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-w-14 px-3 text-xs"
              onClick={() => {
                onChange(applyServerUrlPort(value, port))
                setOpen(true)
              }}
            >
              :{port}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">{t('mobile.lanHint')}</p>
    </div>
  )
}
