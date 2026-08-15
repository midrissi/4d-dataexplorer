import { Button, Checkbox, Dialog, useConfirm, useToast } from '@4d/ui'
import { Columns3, Download, FileType2, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { downloadBytes } from '~/lib/download-bytes'
import {
  defaultFilename,
  type EntityIoAttribute,
  type EntityIoFormatId,
  exportableAttributes,
  getEntityIoFormat,
  listExportFormats,
  stripSystemFields,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect } from './EntityIoSelect'

const LARGE_SELECTION_WARN = 10_000

export function EntityExportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: EntityIoTarget | null
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const formats = useMemo(() => listExportFormats(), [])
  const [formatId, setFormatId] = useState<EntityIoFormatId>('json')
  const [attrs, setAttrs] = useState<EntityIoAttribute[]>([])
  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null)

  const dataclassName = target?.dataclassName ?? ''

  useEffect(() => {
    if (!open || !dataclassName) return
    let cancelled = false
    void api.getDataclassSchema(dataclassName).then((schema) => {
      if (cancelled) return
      const list = exportableAttributes(schema.attributes as EntityIoAttribute[])
      setAttrs(list)
      const preferred = target?.columns?.filter((c) => list.some((a) => a.name === c))
      setSelectedCols(preferred?.length ? preferred : list.map((a) => a.name))
    })
    return () => {
      cancelled = true
    }
  }, [open, dataclassName, target?.columns])

  const toggleCol = (name: string) => {
    setSelectedCols((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    )
  }

  const handleExport = useCallback(async () => {
    if (!target || selectedCols.length === 0) return
    const format = getEntityIoFormat(formatId)
    if (!format) return

    const count = target.selectionCount ?? 0
    if (count > LARGE_SELECTION_WARN) {
      const ok = await confirm({
        title: t('entity.io.largeExportTitle'),
        description: t('entity.io.largeExportDescription', { count }),
        confirmText: t('entity.io.continue'),
        cancelText: t('entity.cancel'),
      })
      if (!ok) return
    }

    setBusy(true)
    setProgress({ fetched: 0, total: count || 0 })
    try {
      const fetched = await api.fetchAllEntities({
        dataclass: target.dataclassName,
        entitySetId: target.entitySetId?.trim() || undefined,
        filter: target.entitySetId ? undefined : target.filter,
        filterParams: target.entitySetId ? undefined : target.filterParams,
        attributes: selectedCols,
        onProgress: (fetchedCount, total) => setProgress({ fetched: fetchedCount, total }),
      })
      const rows = fetched.entities.map((e) => stripSystemFields(e as Record<string, unknown>))
      const text = format.serialize(rows, {
        dataclassName: target.dataclassName,
        columns: selectedCols,
      })
      const filename = defaultFilename(target.dataclassName, format)
      await downloadBytes({
        filename,
        bytes: new TextEncoder().encode(text),
        mime: format.mime,
      })
      toast({
        title: t('entity.io.exportDone'),
        description: t('entity.io.exportDoneDescription', { count: rows.length, filename }),
      })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: t('entity.io.exportFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [confirm, formatId, onOpenChange, selectedCols, t, target, toast])

  const needsEntitySet = !target?.entitySetId?.trim() && !target?.filter
  const scope = target?.entitySetId?.trim()
    ? t('entity.io.scopeSelection')
    : needsEntitySet
      ? t('entity.io.scopeAll')
      : t('entity.io.scopeFilter')

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <EntityIoDialogFrame
          icon={Download}
          title={t('entity.io.exportTitle')}
          description={t('entity.io.exportDescription', { dataclass: dataclassName })}
          badge={scope}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                {t('entity.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleExport()}
                disabled={busy || selectedCols.length === 0}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t('entity.io.export')}
              </Button>
            </>
          }
        >
          <EntityIoPanel icon={FileType2} title={t('entity.io.formatLabel')}>
            <EntityIoSelect
              id="export-format"
              ariaLabel={t('entity.io.formatLabel')}
              value={formatId}
              onValueChange={setFormatId}
              options={formats.map((f) => ({
                value: f.id,
                label: t(`entity.io.formats.${f.id}`),
              }))}
            />
          </EntityIoPanel>

          <EntityIoPanel
            icon={Columns3}
            title={t('entity.io.columns')}
            count={selectedCols.length}
            contentClassName="max-h-64 overflow-auto overscroll-contain p-0"
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                disabled={attrs.length === 0}
                onClick={() =>
                  setSelectedCols(
                    selectedCols.length === attrs.length ? [] : attrs.map((a) => a.name)
                  )
                }
              >
                {selectedCols.length === attrs.length && attrs.length > 0
                  ? t('entity.io.selectNone')
                  : t('entity.io.selectAll')}
              </Button>
            }
          >
            {attrs.map((a) => (
              <label
                key={a.name}
                htmlFor={`export-column-${a.name}`}
                className="flex min-h-8 cursor-pointer items-center gap-2 border-border/50 border-b px-2 py-1 text-sm transition-colors last:border-b-0 hover:bg-muted/35"
              >
                <Checkbox
                  id={`export-column-${a.name}`}
                  checked={selectedCols.includes(a.name)}
                  onCheckedChange={() => toggleCol(a.name)}
                />
                <span className="font-mono text-xs">
                  {a.name}
                  <span className="text-muted-foreground"> · {a.type}</span>
                </span>
              </label>
            ))}
          </EntityIoPanel>

          {progress ? (
            <p
              className="rounded-md border border-border/70 bg-muted/10 px-2 py-1.5 text-muted-foreground text-xs"
              aria-live="polite"
            >
              {t('entity.io.progress', {
                fetched: progress.fetched,
                total: progress.total || '…',
              })}
            </p>
          ) : null}
        </EntityIoDialogFrame>
      </Dialog>
      <ConfirmDialog />
    </>
  )
}
