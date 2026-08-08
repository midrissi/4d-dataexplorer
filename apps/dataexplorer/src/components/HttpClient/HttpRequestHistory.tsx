import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@4d/ui'
import { History } from 'lucide-react'
import {
  formatRelativeTime,
  SavedListBadge,
  SavedListMetaPill,
  SavedListPanel,
  SavedListRow,
} from '~/components/SavedListPanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { HttpClientSeed } from '~/store/http-client-types'
import { useHttpRequestFavouritesStore } from '~/store/http-request-favourites'
import {
  HTTP_REQUEST_HISTORY_LIMIT_OPTIONS,
  type HttpRequestHistoryItem,
} from '~/store/http-request-history'
import {
  httpAccentBarClass,
  httpMethodTone,
  httpRequestLabel,
  httpStatusTone,
} from './http-request-display'

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
  const mobile = isMobileShell()
  const isFavourite = useHttpRequestFavouritesStore((state) => state.isFavourite(item.seed))
  const toggleFavourite = useHttpRequestFavouritesStore((state) => state.toggleFavourite)
  const { method, path, fullUrl, isCustomOrigin } = httpRequestLabel(item.seed)
  const methodStyles = httpMethodTone(method)
  const absoluteTime = new Date(item.timestamp).toLocaleString()

  return (
    <SavedListRow
      accentClassName={httpAccentBarClass(item.status, item.error)}
      badge={
        <SavedListBadge className={cn(methodStyles.bg, methodStyles.text)}>{method}</SavedListBadge>
      }
      primary={isCustomOrigin ? fullUrl : path}
      primaryClassName={cn('truncate', isCustomOrigin && 'text-muted-foreground')}
      primaryTitle={fullUrl}
      meta={
        <>
          {item.error ? (
            <SavedListMetaPill className={httpStatusTone(undefined, item.error)}>
              {t('httpClient.error')}
            </SavedListMetaPill>
          ) : item.status != null ? (
            <SavedListMetaPill className={httpStatusTone(item.status)}>
              {item.status}
            </SavedListMetaPill>
          ) : null}
          {item.durationMs != null ? (
            <span className="w-10 text-right text-[10px] text-muted-foreground tabular-nums">
              {Math.round(item.durationMs)}
              <span className="text-muted-foreground/70">ms</span>
            </span>
          ) : null}
          {!mobile ? (
            <span
              className="w-14 truncate text-right text-[10px] text-muted-foreground/80 tabular-nums"
              title={absoluteTime}
            >
              {formatRelativeTime(item.timestamp)}
            </span>
          ) : null}
        </>
      }
      favourite={{
        active: isFavourite,
        onToggle: () => toggleFavourite(item.seed),
        addLabel: t('httpClient.addFavourite'),
        removeLabel: t('httpClient.removeFavourite'),
      }}
      onRemove={onRemove}
      removeLabel={t('httpClient.removeHistoryItem')}
      onOpen={onOpen}
    />
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
  const mobile = isMobileShell()

  return (
    <SavedListPanel
      icon={History}
      title={t('httpClient.lastRequests')}
      titleId={mobile ? 'http-request-history-title' : undefined}
      count={requests.length}
      countMax={maxCount}
      headerExtra={
        <Select value={String(maxCount)} onValueChange={(value) => onMaxCountChange(Number(value))}>
          <SelectTrigger
            className={cn(
              'h-6 w-auto gap-1 border-dashed bg-background/50 px-1.5 text-[10px] text-muted-foreground',
              mobile && 'h-9 px-2 text-xs'
            )}
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
      }
      clearLabel={t('httpClient.clearAll')}
      onClear={onClearRequests}
      clearConfirm={{
        title: t('httpClient.clearHistoryTitle'),
        description: t('httpClient.clearHistoryDescription'),
        confirmText: t('httpClient.clearAll'),
        cancelText: t('common.cancel'),
      }}
      emptyTitle={t('httpClient.noHistoryTitle')}
      emptyDescription={t('httpClient.noHistoryDescription')}
      onClose={onClose}
    >
      {requests.map((item) => (
        <HistoryRequestRow
          key={item.id}
          item={item}
          onOpen={() => onOpenRequest(item.seed)}
          onRemove={() => onRemoveRequest(item.id)}
        />
      ))}
    </SavedListPanel>
  )
}
