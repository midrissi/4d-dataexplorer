import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useConfirm,
} from '@4d/ui'
import { History, Trash2 } from 'lucide-react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { joinOriginAndPath, resolveHttpMethod } from '~/lib/http-client'
import { getBaseUrl } from '~/lib/platform'
import type { HttpClientSeed } from '~/store/http-client-types'
import {
  HTTP_REQUEST_HISTORY_LIMIT_OPTIONS,
  type HttpRequestHistoryItem,
} from '~/store/http-request-history'

function methodTone(method: string): { text: string; bg: string } {
  switch (method.toUpperCase()) {
    case 'GET':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      }
    case 'POST':
      return {
        text: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/25',
      }
    case 'PUT':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/25',
      }
    case 'PATCH':
      return {
        text: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/25',
      }
    case 'DELETE':
      return {
        text: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/25',
      }
    default:
      return {
        text: 'text-muted-foreground',
        bg: 'bg-muted/60 border-border/70',
      }
  }
}

function statusTone(status?: number, error?: string): string {
  if (error) return 'text-destructive bg-destructive/10 border-destructive/25'
  if (status == null) return 'text-muted-foreground bg-muted/50 border-border/60'
  if (status >= 200 && status < 300)
    return 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
  if (status >= 300 && status < 400)
    return 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25'
  if (status >= 400) return 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/25'
  return 'text-muted-foreground bg-muted/50 border-border/60'
}

function accentBarClass(status?: number, error?: string): string {
  if (error || (status != null && status >= 400)) return 'bg-destructive'
  if (status != null && status >= 300 && status < 400) return 'bg-amber-500'
  if (status != null && status >= 200 && status < 300) return 'bg-emerald-500'
  return 'bg-muted-foreground/40'
}

function historyRequestLabel(seed: HttpClientSeed): {
  method: string
  path: string
  fullUrl: string
  isCustomOrigin: boolean
} {
  const method = resolveHttpMethod({
    method: seed.method ?? 'GET',
    customMethod: seed.customMethod ?? '',
  })
  const currentOrigin = getBaseUrl().replace(/\/$/, '') || ''
  const isCustomOrigin = seed.targetMode === 'custom'
  const origin = isCustomOrigin
    ? (seed.customOrigin ?? '').trim().replace(/\/$/, '')
    : currentOrigin
  const path = seed.path || '/'
  const fullUrl = origin ? joinOriginAndPath(origin, path) : path
  return { method, path, fullUrl, isCustomOrigin }
}

function formatRelativeTime(timestamp: number): string {
  const deltaSec = Math.round((timestamp - Date.now()) / 1000)
  const abs = Math.abs(deltaSec)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (abs < 60) return rtf.format(deltaSec, 'second')
  const deltaMin = Math.round(deltaSec / 60)
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, 'minute')
  const deltaHour = Math.round(deltaMin / 60)
  if (Math.abs(deltaHour) < 24) return rtf.format(deltaHour, 'hour')
  return rtf.format(Math.round(deltaHour / 24), 'day')
}

function HistoryRequestRow({
  item,
  onOpen,
  onRemove,
}: {
  item: HttpRequestHistoryItem
  onOpen: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { method, path, fullUrl, isCustomOrigin } = historyRequestLabel(item.seed)
  const methodStyles = methodTone(method)
  const absoluteTime = new Date(item.timestamp).toLocaleString()

  return (
    <div className="group relative flex items-center gap-2 border-border/50 border-b px-2 py-1 last:border-b-0 hover:bg-muted/35">
      <span
        aria-hidden
        className={cn(
          'absolute top-1 bottom-1 left-0 w-0.5 rounded-full',
          accentBarClass(item.status, item.error)
        )}
      />

      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 py-0.5 pl-1.5 text-left"
        onClick={onOpen}
        title={fullUrl}
      >
        <span
          className={cn(
            'inline-flex h-5 min-w-11 shrink-0 items-center justify-center rounded border px-1.5 font-semibold text-[10px] uppercase tracking-wide',
            methodStyles.bg,
            methodStyles.text
          )}
        >
          {method}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
          {isCustomOrigin ? <span className="text-muted-foreground">{fullUrl}</span> : path}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {item.error ? (
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 font-medium text-[10px] tabular-nums',
                statusTone(undefined, item.error)
              )}
            >
              {t('httpClient.error')}
            </span>
          ) : item.status != null ? (
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 font-medium text-[10px] tabular-nums',
                statusTone(item.status)
              )}
            >
              {item.status}
            </span>
          ) : null}

          {item.durationMs != null ? (
            <span className="w-10 text-right text-[10px] text-muted-foreground tabular-nums">
              {Math.round(item.durationMs)}
              <span className="text-muted-foreground/70">ms</span>
            </span>
          ) : null}

          <span
            className="w-14 truncate text-right text-[10px] text-muted-foreground/80 tabular-nums"
            title={absoluteTime}
          >
            {formatRelativeTime(item.timestamp)}
          </span>
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        onClick={onRemove}
        aria-label={t('httpClient.removeHistoryItem')}
        title={t('httpClient.removeHistoryItem')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function HttpRequestHistory({
  requests,
  maxCount,
  onOpenRequest,
  onRemoveRequest,
  onClearRequests,
  onMaxCountChange,
  onClose,
}: {
  requests: HttpRequestHistoryItem[]
  maxCount: number
  onOpenRequest: (seed: HttpClientSeed) => void
  onRemoveRequest: (id: string) => void
  onClearRequests: () => void
  onMaxCountChange: (count: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()

  const handleClearAll = async () => {
    const ok = await confirm({
      title: t('httpClient.clearHistoryTitle'),
      description: <span>{t('httpClient.clearHistoryDescription')}</span>,
      confirmText: t('httpClient.clearAll'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    })
    if (!ok) return
    onClearRequests()
    onClose()
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-muted/10 shadow-xs">
      <ConfirmDialog />
      <div className="flex items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="font-medium text-xs">{t('httpClient.lastRequests')}</p>
          {requests.length > 0 ? (
            <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
              {requests.length}
              <span className="text-muted-foreground/60">/{maxCount}</span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Select
            value={String(maxCount)}
            onValueChange={(value) => onMaxCountChange(Number(value))}
          >
            <SelectTrigger
              className="h-6 w-auto gap-1 border-dashed bg-background/50 px-1.5 text-[10px] text-muted-foreground"
              aria-label={t('httpClient.historyLimit')}
            >
              <span className="text-muted-foreground/70">{t('httpClient.historyLimit')}</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_REQUEST_HISTORY_LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={() => void handleClearAll()}
            disabled={requests.length === 0}
          >
            {t('httpClient.clearAll')}
          </Button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="p-2">
          <EmptyPanel
            icon={History}
            badgeTone="muted"
            title={t('httpClient.noHistoryTitle')}
            description={t('httpClient.noHistoryDescription')}
            ghost="rows"
            bordered
            size="sm"
          />
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto overscroll-contain bg-background/40">
          {requests.map((item) => (
            <HistoryRequestRow
              key={item.id}
              item={item}
              onOpen={() => onOpenRequest(item.seed)}
              onRemove={() => onRemoveRequest(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
