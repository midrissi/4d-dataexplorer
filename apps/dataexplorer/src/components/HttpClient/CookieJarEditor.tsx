import { Button, cn } from '@4d/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  getCookies,
  importHttpJarCookiesIfNeeded,
  onConnectionChange,
  updateConnectionCookies,
} from '~/lib/platform'
import { createHttpId } from '~/store/http-client-types'

type CookieRow = {
  id: string
  key: string
  value: string
}

function cookiesToRows(cookies: Record<string, string>): CookieRow[] {
  return Object.entries(cookies).map(([key, value]) => ({
    id: createHttpId(),
    key,
    value,
  }))
}

function rowsToCookies(rows: CookieRow[]): Record<string, string> {
  const next: Record<string, string> = {}
  for (const row of rows) {
    const name = row.key.trim()
    if (!name) continue
    next[name] = row.value
  }
  return next
}

/**
 * CRUD editor for the connection cookie jar used by the HTTP Client.
 */
export function CookieJarEditor({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<CookieRow[]>(() => cookiesToRows(getCookies()))
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const dirtyRef = useRef(false)

  useEffect(() => {
    return onConnectionChange(() => {
      if (dirtyRef.current) return
      setRows(cookiesToRows(getCookies()))
    })
  }, [])

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    void (async () => {
      await importHttpJarCookiesIfNeeded()
      if (cancelled || dirtyRef.current) return
      setRows(cookiesToRows(getCookies()))
    })()
    return () => {
      cancelled = true
    }
  }, [disabled])

  const persist = useCallback(async (nextRows: CookieRow[]) => {
    dirtyRef.current = false
    await updateConnectionCookies(rowsToCookies(nextRows))
  }, [])

  const updateRow = (id: string, patch: Partial<Pick<CookieRow, 'key' | 'value'>>) => {
    dirtyRef.current = true
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const flush = () => {
    if (!dirtyRef.current) return
    void persist(rowsRef.current)
  }

  const removeRow = (id: string) => {
    const next = rowsRef.current.filter((row) => row.id !== id)
    setRows(next)
    dirtyRef.current = false
    void persist(next)
  }

  const addRow = () => {
    const next = [...rowsRef.current, { id: createHttpId(), key: '', value: '' }]
    setRows(next)
    dirtyRef.current = true
  }

  return (
    <div className={cn('space-y-2', disabled && 'pointer-events-none opacity-55')}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t('httpClient.cookieJar')}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {t('httpClient.cookieJarHint')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0"
          onClick={addRow}
          disabled={disabled}
        >
          <Plus />
          {t('httpClient.addCookie')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-border/70 border-dashed px-3 py-4 text-center text-muted-foreground text-xs">
          {t('httpClient.cookieJarEmpty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/70">
          {rows.map((row) => (
            <div
              key={row.id}
              className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_2rem] items-stretch border-border/60 border-b last:border-b-0"
            >
              <div className="min-w-0 border-border/50 border-r">
                <input
                  type="text"
                  value={row.key}
                  placeholder={t('httpClient.cookieName')}
                  onChange={(event) => updateRow(row.id, { key: event.target.value })}
                  onBlur={flush}
                  className="h-6 w-full bg-transparent px-2 font-mono text-xs outline-none focus-visible:bg-muted/40"
                  aria-label={t('httpClient.cookieName')}
                  disabled={disabled}
                />
              </div>
              <div className="min-w-0 border-border/50 border-r">
                <input
                  type="text"
                  value={row.value}
                  placeholder={t('httpClient.cookieValue')}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                  onBlur={flush}
                  className="h-6 w-full bg-transparent px-2 font-mono text-xs outline-none focus-visible:bg-muted/40"
                  aria-label={t('httpClient.cookieValue')}
                  disabled={disabled}
                />
              </div>
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                  onClick={() => removeRow(row.id)}
                  aria-label={t('httpClient.removeCookie')}
                  disabled={disabled}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
