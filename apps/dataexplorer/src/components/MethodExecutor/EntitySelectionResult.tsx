import { Button, cn } from '@4d/ui'
import { ExternalLink, TableProperties } from 'lucide-react'
import { EntitySetActionsMenu } from '~/components/EntityIo/EntitySetActionsMenu'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { useTabsStore } from '~/store/tabs'
import type { DetectedMethodResult } from './detect-method-result'
import { EmptyEntitySelection } from './EmptyEntitySelection'
import { EntitySelectionKeyBar } from './EntitySelectionKeyBar'
import { PreviewCell } from './PreviewCell'
import { previewSelectionColumns } from './preview-selection-columns'

const PREVIEW_LIMIT = 100

export function EntitySelectionResult({
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
  const preview = result.entities.slice(0, PREVIEW_LIMIT)
  const isEmpty = result.count === 0 || preview.length === 0
  const entitySetId = result.entitySetId?.trim() || undefined

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

  if (isEmpty) {
    return (
      <EmptyEntitySelection
        dataClass={result.dataClass ?? null}
        entitySetId={entitySetId}
        count={result.count}
        onOpenSelection={result.dataClass ? openAll : undefined}
      />
    )
  }

  const columns = previewSelectionColumns(preview)

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
        {result.dataClass && entitySetId ? (
          <EntitySetActionsMenu
            target={{
              dataclassName: result.dataClass,
              entitySetId,
              selectionCount: result.count,
            }}
          />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10">
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 border-border/50 border-b text-muted-foreground',
            mobile ? 'px-2.5 py-1.5 text-[11px]' : 'px-2.5 py-1 text-[10px]'
          )}
        >
          <TableProperties className="h-3 w-3" aria-hidden />
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
