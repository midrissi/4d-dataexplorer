import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ClickToCopy,
  CodeEditor,
  cn,
} from '@4d/ui'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Inbox,
  Info,
  KeyRound,
  Play,
  Rows3,
  Shield,
  TableProperties,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import { PrivateBinaryResult } from '~/components/DecodedBinary/PrivateBinaryResult'
import { DeferredImage } from '~/components/DeferredImage'
import { EmptyPanel } from '~/components/EmptyPanel'
import { EntityViewer } from '~/components/EntityViewer'
import { useTranslation } from '~/i18n'
import { getImageUri, isDeferredRelationValue } from '~/lib/fieldPaths'
import { isMobileShell } from '~/lib/platform'
import { useTabsStore } from '~/store/tabs'
import type { DetectedMethodResult, MethodWebformMeta } from './detect-method-result'

function pretty(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2)
  return serialized === undefined ? String(value) : serialized
}

function notificationAlertVariant(
  type: string | undefined
): 'default' | 'destructive' | 'success' | 'warning' {
  const normalized = type?.trim().toLowerCase()
  if (normalized === 'warning' || normalized === 'warn') return 'warning'
  if (normalized === 'error' || normalized === 'danger' || normalized === 'destructive') {
    return 'destructive'
  }
  if (normalized === 'success' || normalized === 'ok') return 'success'
  return 'default'
}

function NotificationIcon({ type }: { type?: string }) {
  const variant = notificationAlertVariant(type)
  if (variant === 'warning') return <AlertTriangle aria-hidden />
  if (variant === 'destructive') return <XCircle aria-hidden />
  if (variant === 'success') return <CheckCircle2 aria-hidden />
  return <Info aria-hidden />
}

function WebformMetaBar({ webform }: { webform: MethodWebformMeta }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const notification = webform.notification
  const stamp = webform.privilegeStamp
  if (!notification && stamp === undefined) return null

  const alertVariant = notificationAlertVariant(notification?.type)
  const typeLabel = notification?.type?.trim()

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {notification ? (
        <Alert variant={alertVariant} className="py-2.5">
          <NotificationIcon type={notification.type} />
          <AlertTitle className="flex flex-wrap items-center gap-1.5 text-foreground text-xs">
            {t('methodExecutor.notification')}
            {typeLabel ? (
              <Badge
                variant={
                  alertVariant === 'warning'
                    ? 'warning'
                    : alertVariant === 'destructive'
                      ? 'destructive'
                      : alertVariant === 'success'
                        ? 'success'
                        : 'secondary'
                }
                className="h-4 px-1.5 font-medium text-[10px] uppercase tracking-wide"
              >
                {typeLabel}
              </Badge>
            ) : null}
          </AlertTitle>
          <AlertDescription className="text-foreground text-xs leading-snug">
            {notification.message}
          </AlertDescription>
        </Alert>
      ) : null}
      {stamp !== undefined ? (
        <div
          role="status"
          aria-label={`${t('methodExecutor.privilegeStamp')}: ${stamp}`}
          className={cn(
            'flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-border/80 bg-muted/30',
            'px-2.5 py-1.5'
          )}
        >
          <span className="font-medium text-foreground text-xs">
            {t('methodExecutor.privilegeStamp')}
          </span>
          <ClickToCopy
            value={String(stamp)}
            tooltipLabel={t('common.clickToCopy')}
            tooltipCopiedLabel={t('common.copied')}
            aria-label={`${t('methodExecutor.privilegeStamp')}: ${stamp}`}
            className={cn(
              'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border bg-background font-mono text-foreground hover:bg-accent',
              mobile ? 'min-h-9 px-2 py-1.5 text-xs' : 'px-2 py-0.5 text-xs'
            )}
          >
            <Shield className="h-3 w-3 shrink-0 text-foreground/70" aria-hidden />
            <span className="min-w-0 truncate tabular-nums">{stamp}</span>
          </ClickToCopy>
        </div>
      ) : null}
    </div>
  )
}

function isSelectionColumn(entities: Record<string, unknown>[], column: string): boolean {
  for (const entity of entities) {
    const value = entity[column]
    if (value === null || value === undefined) continue
    return isDeferredRelationValue(value)
  }
  return false
}

function previewColumns(entities: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  for (const entity of entities) {
    for (const key of Object.keys(entity)) {
      if (!key.startsWith('__')) keys.add(key)
    }
  }
  return Array.from(keys)
    .filter((key) => !isSelectionColumn(entities, key))
    .slice(0, 5)
}

function PreviewCell({ value }: { value: unknown }): ReactNode {
  if (getImageUri(value)) {
    return <DeferredImage value={value} className="h-6 w-6 rounded-sm object-cover" />
  }
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/70">—</span>
  }
  if (typeof value === 'object') {
    return (
      <span className="truncate font-mono text-[11px] text-foreground/90" title={pretty(value)}>
        {pretty(value)}
      </span>
    )
  }
  const text = String(value)
  return (
    <span className="truncate font-mono text-[11px] text-foreground/90" title={text}>
      {text}
    </span>
  )
}

function EntitySelectionKeyBar({ entitySetId }: { entitySetId: string }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2 rounded-md border bg-muted/20',
        mobile ? 'px-2.5 py-1.5' : 'px-2.5 py-1.5'
      )}
    >
      <span className="text-[11px] text-muted-foreground">{t('methodExecutor.selectionKey')}</span>
      <ClickToCopy
        value={entitySetId}
        tooltipLabel={t('common.clickToCopy')}
        tooltipCopiedLabel={t('common.copied')}
        className={cn(
          'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border bg-background font-mono text-foreground hover:bg-accent',
          mobile ? 'min-h-9 px-2 py-1.5 text-xs' : 'px-2 py-0.5 text-xs'
        )}
      >
        <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate">{entitySetId}</span>
      </ClickToCopy>
    </div>
  )
}

function EmptyEntitySelection({
  dataClass,
  entitySetId,
}: {
  dataClass: string | null
  entitySetId?: string
}) {
  const { t } = useTranslation()
  const name = dataClass ?? t('methodExecutor.entitySelection')

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {entitySetId ? <EntitySelectionKeyBar entitySetId={entitySetId} /> : null}
      <EmptyPanel
        icon={Inbox}
        badgeLabel="0"
        badgeTone="primary"
        title={t('methodExecutor.emptySelectionTitle')}
        description={t('methodExecutor.emptySelectionDescription', { name })}
        ghost="rows"
        bordered
        size="lg"
        className="min-h-0 flex-1"
        chips={[
          { icon: Rows3, label: name, tone: 'primary' },
          { icon: KeyRound, label: t('methodExecutor.emptySelectionHint'), tone: 'amber' },
        ]}
      />
    </div>
  )
}

function EntitySelectionResult({
  result,
  selectionTabTitle,
}: {
  result: Extract<DetectedMethodResult, { kind: 'entitysel' }>
  selectionTabTitle?: string
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const openEntitySetTab = useTabsStore((state) => state.openEntitySetTab)
  const openTab = useTabsStore((state) => state.openTab)
  const previewLimit = 100
  const preview = result.entities.slice(0, previewLimit)
  const isEmpty = result.count === 0 || preview.length === 0
  const entitySetId = result.entitySetId?.trim() || undefined

  if (isEmpty) {
    return <EmptyEntitySelection dataClass={result.dataClass ?? null} entitySetId={entitySetId} />
  }

  const columns = previewColumns(preview)

  const openAll = () => {
    if (!result.dataClass) return
    if (entitySetId) {
      openEntitySetTab({
        dataclassName: result.dataClass,
        entitySetId,
        customTitle: selectionTabTitle ?? `${result.dataClass} method result`,
        forceNew: true,
      })
      return
    }
    openTab(result.dataClass)
  }

  const summary = t('methodExecutor.showingFirst', {
    name: result.dataClass ?? t('methodExecutor.entitySelection'),
    count: result.count,
    shown: preview.length,
  })

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        mobile ? 'gap-2' : 'gap-3'
      )}
    >
      {entitySetId ? <EntitySelectionKeyBar entitySetId={entitySetId} /> : null}

      <div
        className={cn(
          'flex shrink-0 gap-2',
          mobile ? 'items-center' : 'items-center justify-between'
        )}
      >
        <p
          className={cn(
            'min-w-0 flex-1 truncate text-muted-foreground',
            mobile ? 'text-xs leading-snug' : 'text-sm'
          )}
          title={summary}
        >
          {summary}
        </p>
        <Button
          size={mobile ? 'sm' : 'xs'}
          variant={mobile ? 'outline' : 'default'}
          className={cn(mobile && 'h-9 shrink-0 gap-1.5 px-2.5')}
          onClick={openAll}
          disabled={!result.dataClass}
        >
          <ExternalLink className={mobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
          {mobile ? t('methodExecutor.openAllShort') : t('methodExecutor.openAll')}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10">
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 border-border/50 border-b text-muted-foreground',
            mobile ? 'px-2.5 py-1.5 text-[11px]' : 'px-2.5 py-1 text-[10px]'
          )}
        >
          <TableProperties className={mobile ? 'h-3 w-3' : 'h-3 w-3'} aria-hidden />
          <span>
            {t('httpClient.textPreviewCsvMeta', {
              rows: preview.length,
              cols: columns.length + 1,
            })}
          </span>
        </div>

        {mobile ? (
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto overscroll-contain p-1.5">
            {preview.map((entity, index) => {
              const key = String(entity.__KEY ?? index)
              return (
                <li
                  key={key}
                  className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="font-medium text-muted-foreground text-xs tabular-nums">
                      #{index + 1}
                    </span>
                    <span
                      className="min-w-0 truncate font-mono text-foreground text-xs"
                      title={key}
                    >
                      {t('methodExecutor.entityKey')}: {key}
                    </span>
                  </div>
                  <dl className="space-y-1.5">
                    {columns.map((column) => (
                      <div key={column} className="grid grid-cols-[minmax(0,6.5rem)_1fr] gap-2">
                        <dt
                          className="truncate font-medium text-muted-foreground text-xs"
                          title={column}
                        >
                          {column}
                        </dt>
                        <dd className="min-w-0">
                          <PreviewCell value={entity[column]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <tr>
                  <th className="w-10 border-border/60 border-r border-b px-2 py-1.5 text-center font-medium text-muted-foreground tabular-nums">
                    #
                  </th>
                  <th className="max-w-72 truncate border-border/60 border-b px-2.5 py-1.5 font-semibold text-foreground">
                    {t('methodExecutor.entityKey')}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="max-w-72 truncate border-border/60 border-b px-2.5 py-1.5 font-semibold text-foreground"
                      title={column}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((entity, index) => (
                  <tr
                    key={String(entity.__KEY ?? index)}
                    className="odd:bg-background/40 even:bg-muted/20 hover:bg-muted/40"
                  >
                    <td className="border-border/40 border-r px-2 py-1 text-center text-[10px] text-muted-foreground tabular-nums">
                      {index + 1}
                    </td>
                    <td className="max-w-72 truncate border-border/30 border-b px-2.5 py-1 font-mono text-[11px] text-foreground/90">
                      {String(entity.__KEY ?? '—')}
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column}
                        className="max-w-72 truncate border-border/30 border-b px-2.5 py-1"
                      >
                        <PreviewCell value={entity[column]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function ResultPanel({
  result,
  selectionTabTitle,
}: {
  result: DetectedMethodResult | null
  selectionTabTitle?: string
}) {
  const { t } = useTranslation()
  if (!result) {
    return (
      <EmptyPanel
        icon={FlaskConical}
        badgeIcon={Play}
        badgeTone="primary"
        title={t('methodExecutor.emptyResultTitle')}
        description={t('methodExecutor.emptyResultDescription')}
        ghost="rows"
        size="lg"
        className="h-full min-h-0"
      />
    )
  }

  const webformBar = result.webform ? <WebformMetaBar webform={result.webform} /> : null

  let body: ReactNode
  if (result.kind === 'entity') {
    const dataclassName =
      typeof result.value.__DATACLASS === 'string'
        ? result.value.__DATACLASS
        : typeof result.value.__entityModel === 'string'
          ? result.value.__entityModel
          : undefined
    body = (
      <div className="min-h-0 flex-1 overflow-auto">
        <EntityViewer entity={result.value} dataclassName={dataclassName} />
      </div>
    )
  } else if (result.kind === 'entitysel') {
    body = <EntitySelectionResult result={result} selectionTabTitle={selectionTabTitle} />
  } else if (isPrivateBinaryObject(result.value)) {
    body = <PrivateBinaryResult value={result.value} />
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeEditor value={pretty(result.value)} readOnly height="100%" toolbar />
      </div>
    )
  }

  if (!webformBar) return body

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {webformBar}
      {body}
    </div>
  )
}
