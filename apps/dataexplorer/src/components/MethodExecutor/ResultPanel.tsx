import { Button, ClickToCopy, CodeEditor } from '@4d/ui'
import {
  ExternalLink,
  FlaskConical,
  Inbox,
  KeyRound,
  Play,
  Rows3,
  TableProperties,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import { PrivateBinaryResult } from '~/components/DecodedBinary/PrivateBinaryResult'
import { DeferredImage } from '~/components/DeferredImage'
import { EmptyPanel } from '~/components/EmptyPanel'
import { EntityViewer } from '~/components/EntityViewer'
import { useTranslation } from '~/i18n'
import { getImageUri, isDeferredRelationValue } from '~/lib/fieldPaths'
import { useTabsStore } from '~/store/tabs'
import type { DetectedMethodResult } from './detect-method-result'

function pretty(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2)
  return serialized === undefined ? String(value) : serialized
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

function EntitySelectionKeyBar({ entitySetId }: { entitySetId: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{t('methodExecutor.selectionKey')}</span>
      <ClickToCopy
        value={entitySetId}
        tooltipLabel={t('common.clickToCopy')}
        tooltipCopiedLabel={t('common.copied')}
        className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border bg-background px-2 py-0.5 font-mono text-foreground text-xs hover:bg-accent"
      >
        <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{entitySetId}</span>
      </ClickToCopy>
    </div>
  )
}

function EntitySelectionResult({
  result,
  selectionTabTitle,
}: {
  result: Extract<DetectedMethodResult, { kind: 'entitysel' }>
  /** Custom title when opening the selection in a new tab. Defaults to "{dataClass} method result". */
  selectionTabTitle?: string
}) {
  const { t } = useTranslation()
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {entitySetId ? <EntitySelectionKeyBar entitySetId={entitySetId} /> : null}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t('methodExecutor.showingFirst', {
            name: result.dataClass ?? t('methodExecutor.entitySelection'),
            count: result.count,
            shown: preview.length,
          })}
        </p>
        <Button size="xs" onClick={openAll} disabled={!result.dataClass}>
          <ExternalLink />
          {t('methodExecutor.openAll')}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10">
        <div className="flex shrink-0 items-center gap-2 border-border/50 border-b px-2.5 py-1 text-[10px] text-muted-foreground">
          <TableProperties className="h-3 w-3" />
          <span>
            {t('httpClient.textPreviewCsvMeta', {
              rows: preview.length,
              cols: columns.length + 1,
            })}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <tr>
                <th className="w-10 border-border/60 border-r border-b px-2 py-1.5 text-center font-medium text-muted-foreground tabular-nums">
                  #
                </th>
                <th className="max-w-72 truncate border-border/60 border-b px-2.5 py-1.5 font-semibold text-foreground">
                  Key
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
      </div>
    </div>
  )
}

export function ResultPanel({
  result,
  selectionTabTitle,
}: {
  result: DetectedMethodResult | null
  /** Custom title when opening an entity selection in a new tab. */
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
  if (result.kind === 'entity') {
    const dataclassName =
      typeof result.value.__DATACLASS === 'string'
        ? result.value.__DATACLASS
        : typeof result.value.__entityModel === 'string'
          ? result.value.__entityModel
          : undefined
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <EntityViewer entity={result.value} dataclassName={dataclassName} />
      </div>
    )
  }
  if (result.kind === 'entitysel') {
    return <EntitySelectionResult result={result} selectionTabTitle={selectionTabTitle} />
  }
  if (isPrivateBinaryObject(result.value)) {
    return <PrivateBinaryResult value={result.value} />
  }
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <CodeEditor value={pretty(result.value)} readOnly height="100%" toolbar />
    </div>
  )
}
