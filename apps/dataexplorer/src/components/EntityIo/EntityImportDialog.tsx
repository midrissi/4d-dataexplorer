import { Button, Dialog, SegmentedControl, useToast } from '@4d/ui'
import { Eye, FileJson2, FileUp, Loader2, Settings2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import {
  detectEntityIoFormat,
  type EntityIoFormatId,
  getEntityIoFormat,
  listImportFormats,
  stripSystemFields,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import { EntityIoCodePreview } from './EntityIoCodePreview'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import { EntityIoFilePicker } from './EntityIoFilePicker'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect } from './EntityIoSelect'

type ImportMode = 'create' | 'update'

export function EntityImportDialog({
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
  const formats = useMemo(() => listImportFormats(), [])
  const [formatId, setFormatId] = useState<EntityIoFormatId>('json')
  const [mode, setMode] = useState<ImportMode>('create')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dataclassName = target?.dataclassName ?? ''

  const onFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    try {
      const text = await file.text()
      const detected = detectEntityIoFormat(file.name, text)
      const format = detected ?? getEntityIoFormat(formatId)
      if (!format?.parse) {
        setParseError(t('entity.io.importUnsupported'))
        setRows([])
        return
      }
      setFormatId(format.id)
      const parsed = format.parse(text, { dataclassName })
      setRows(parsed)
    } catch (err) {
      setRows([])
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleImport = async () => {
    if (!target || rows.length === 0) return
    setBusy(true)
    try {
      if (mode === 'create') {
        const prepared = rows.map((r) => stripSystemFields(r))
        const result = await api.createManyEntities(target.dataclassName, prepared)
        toast({
          title: t('entity.io.importDone'),
          description: t('entity.io.importCreated', { count: result.count }),
        })
      } else {
        const prepared = rows.map((r) => stripSystemFields(r, { keepKey: true, keepStamp: true }))
        const missing = prepared.filter((r) => r.__KEY == null || r.__STAMP == null)
        if (missing.length > 0) {
          throw new Error(t('entity.io.importMissingKeys', { count: missing.length }))
        }
        const result = await api.updateManyEntities(target.dataclassName, prepared)
        toast({
          title: t('entity.io.importDone'),
          description: t('entity.io.importUpdated', { count: result.count }),
        })
      }
      eventBus.emit('refresh-view')
      onOpenChange(false)
      setRows([])
      setFileName(null)
    } catch (err) {
      toast({
        title: t('entity.io.importFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const preview = rows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EntityIoDialogFrame
        icon={Upload}
        title={t('entity.io.importTitle')}
        description={t('entity.io.importDescription', { dataclass: dataclassName })}
        badge={rows.length > 0 ? t('entity.io.rowCount', { count: rows.length }) : undefined}
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
              onClick={() => void handleImport()}
              disabled={busy || rows.length === 0}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t('entity.io.import')}
            </Button>
          </>
        }
      >
        <EntityIoPanel icon={FileUp} title={t('entity.io.file')}>
          <EntityIoFilePicker
            accept={formats.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',')}
            fileName={fileName}
            detail={fileName ? t('entity.io.rowCount', { count: rows.length }) : undefined}
            chooseLabel={t('entity.io.chooseFile')}
            changeLabel={t('entity.io.changeFile')}
            onFile={(file) => void onFile(file)}
          />
        </EntityIoPanel>

        <EntityIoPanel icon={FileJson2} title={t('entity.io.formatLabel')}>
          <EntityIoSelect
            id="import-format"
            ariaLabel={t('entity.io.formatLabel')}
            value={formatId}
            onValueChange={setFormatId}
            options={formats.map((f) => ({
              value: f.id,
              label: t(`entity.io.formats.${f.id}`),
            }))}
          />
        </EntityIoPanel>

        <EntityIoPanel icon={Settings2} title={t('entity.io.importMode')}>
          <div className="space-y-1">
            <SegmentedControl
              value={mode}
              onValueChange={(v) => setMode(v)}
              options={[
                { value: 'create', label: t('entity.io.modeCreate') },
                { value: 'update', label: t('entity.io.modeUpdate') },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              {mode === 'create' ? t('entity.io.modeCreateHint') : t('entity.io.modeUpdateHint')}
            </p>
          </div>
        </EntityIoPanel>

        {parseError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-destructive text-xs"
          >
            {parseError}
          </p>
        ) : null}

        {preview.length > 0 ? (
          <EntityIoPanel
            icon={Eye}
            title={t('entity.io.preview')}
            count={rows.length}
            contentClassName="p-0"
          >
            <EntityIoCodePreview value={JSON.stringify(preview, null, 2)} language="json" />
          </EntityIoPanel>
        ) : null}
      </EntityIoDialogFrame>
    </Dialog>
  )
}
