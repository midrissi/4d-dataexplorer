import { Button, Dialog, Input, Label, useToast } from '@4d/ui'
import { Download, Eye, ListChecks, Loader2, Shield, Upload, WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SuggestInput } from '~/components/SuggestInput'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { downloadBytes } from '~/lib/download-bytes'
import {
  type AnonymizeFieldMode,
  type AnonymizeFieldPlan,
  anonymizeEntities,
  buildDefaultAnonymizePlan,
  defaultFilename,
  type EntityIoFormatId,
  getEntityIoFormat,
  listExportFormats,
  stripForCreate,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import {
  anonymizeFakerGroupLabels,
  listAnonymizeFakerSuggestions,
  suggestionsForAnonymizeField,
} from './anonymize-faker-suggestions'
import { EntityIoCodePreview } from './EntityIoCodePreview'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect } from './EntityIoSelect'

export function EntityAnonymizeDialog({
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
  const formats = useMemo(() => listExportFormats(), [])
  const fakerCatalog = useMemo(() => listAnonymizeFakerSuggestions(), [])
  const fakerGroupLabels = useMemo(
    () => anonymizeFakerGroupLabels(t('environments.suggestGroupField')),
    [t]
  )
  const [plan, setPlan] = useState<AnonymizeFieldPlan[]>([])
  const [primaryKey, setPrimaryKey] = useState<string | undefined>()
  const [seed, setSeed] = useState('')
  const [formatId, setFormatId] = useState<EntityIoFormatId>('json')
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const dataclassName = target?.dataclassName ?? ''
  const hasEntitySet = Boolean(target?.entitySetId?.trim())

  useEffect(() => {
    if (!open || !dataclassName) return
    let cancelled = false
    void api.getDataclassSchema(dataclassName).then((schema) => {
      if (cancelled) return
      setPrimaryKey(schema.key)
      setPlan(buildDefaultAnonymizePlan(schema.attributes, schema.key))
    })
    return () => {
      cancelled = true
    }
  }, [open, dataclassName])

  const updateField = (name: string, patch: Partial<AnonymizeFieldPlan>) => {
    setPlan((prev) => prev.map((f) => (f.name === name ? { ...f, ...patch } : f)))
  }

  const loadPreview = useCallback(async () => {
    if (!target?.entitySetId?.trim()) return
    setLoading(true)
    try {
      const page = await api.getEntities(target.dataclassName, {
        entitySetId: target.entitySetId,
        top: 5,
        page: 1,
      })
      const seedNum = seed.trim() ? Number(seed) : undefined
      setPreview(
        anonymizeEntities(page.entities as Record<string, unknown>[], {
          plan,
          seed: Number.isFinite(seedNum) ? seedNum : undefined,
        })
      )
    } catch (err) {
      toast({
        title: t('entity.io.anonymizePreviewFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [plan, seed, t, target, toast])

  useEffect(() => {
    if (open && hasEntitySet && plan.length > 0) void loadPreview()
  }, [open, hasEntitySet, plan.length, loadPreview])

  // Preview mirrors the download payload so the chosen format is what gets highlighted.
  const previewText = useMemo(() => {
    if (preview.length === 0) return ''
    const format = getEntityIoFormat(formatId)
    if (!format) return ''
    return format
      .serialize(
        preview.map((row) => stripForCreate(row, primaryKey)),
        { dataclassName }
      )
      .trimEnd()
  }, [preview, formatId, primaryKey, dataclassName])

  const fetchAnonymized = async () => {
    if (!target?.entitySetId?.trim()) throw new Error(t('entity.deleteManySelectionUnavailable'))
    const fetched = await api.fetchAllEntities({
      dataclass: target.dataclassName,
      entitySetId: target.entitySetId,
    })
    const seedNum = seed.trim() ? Number(seed) : undefined
    return anonymizeEntities(fetched.entities as Record<string, unknown>[], {
      plan,
      seed: Number.isFinite(seedNum) ? seedNum : undefined,
    })
  }

  const handleDownload = async () => {
    if (!target) return
    const format = getEntityIoFormat(formatId)
    if (!format) return
    setBusy(true)
    try {
      const rows = await fetchAnonymized()
      const text = format.serialize(
        rows.map((r) => stripForCreate(r, primaryKey)),
        {
          dataclassName: target.dataclassName,
        }
      )
      const filename = defaultFilename(target.dataclassName, format, '-anonymized')
      await downloadBytes({
        filename,
        bytes: new TextEncoder().encode(text),
        mime: format.mime,
      })
      toast({
        title: t('entity.io.anonymizeDownloaded'),
        description: t('entity.io.exportDoneDescription', { count: rows.length, filename }),
      })
    } catch (err) {
      toast({
        title: t('entity.io.anonymizeFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!target) return
    setBusy(true)
    try {
      const rows = await fetchAnonymized()
      const prepared = rows.map((r) => stripForCreate(r, primaryKey))
      const result = await api.createManyEntities(target.dataclassName, prepared)
      toast({
        title: t('entity.io.anonymizeImported'),
        description: t('entity.io.importCreated', { count: result.count }),
      })
      eventBus.emit('refresh-view')
      onOpenChange(false)
    } catch (err) {
      toast({
        title: t('entity.io.anonymizeFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EntityIoDialogFrame
        icon={Shield}
        title={t('entity.io.anonymizeTitle')}
        description={t('entity.io.anonymizeDescription', { dataclass: dataclassName })}
        badge={hasEntitySet ? t('entity.io.scopeSelection') : undefined}
        size="lg"
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
              variant="secondary"
              size="sm"
              disabled={busy || !hasEntitySet}
              onClick={() => void handleDownload()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t('entity.io.download')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !hasEntitySet}
              onClick={() => void handleImport()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t('entity.io.importAsNew')}
            </Button>
          </>
        }
      >
        {!hasEntitySet ? (
          <p
            role="alert"
            className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-warning text-xs"
          >
            {t('entity.deleteManySelectionUnavailable')}
          </p>
        ) : null}

        <EntityIoPanel icon={WandSparkles} title="Faker">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="anon-seed">{t('entity.io.seed')}</Label>
              <Input
                id="anon-seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="42"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="anon-format">{t('entity.io.formatLabel')}</Label>
              <EntityIoSelect
                id="anon-format"
                value={formatId}
                onValueChange={setFormatId}
                options={formats.map((f) => ({
                  value: f.id,
                  label: t(`entity.io.formats.${f.id}`),
                }))}
              />
            </div>
          </div>
        </EntityIoPanel>

        <EntityIoPanel
          icon={ListChecks}
          title={t('entity.io.fieldPlan')}
          count={plan.length}
          contentClassName="max-h-64 overflow-auto overscroll-contain p-0"
        >
          {plan.map((field) => (
            <div
              key={field.name}
              className="grid min-h-8 grid-cols-[minmax(7rem,1fr)_7rem_minmax(9rem,1.2fr)] items-center gap-1.5 border-border/50 border-b px-2 py-1 text-xs transition-colors last:border-b-0 hover:bg-muted/35"
            >
              <span className="truncate font-mono">{field.name}</span>
              <EntityIoSelect<AnonymizeFieldMode>
                ariaLabel={`${field.name} ${t('entity.io.importMode')}`}
                value={field.mode}
                onValueChange={(mode) => updateField(field.name, { mode })}
                options={[
                  { value: 'faker', label: t('entity.io.modeFaker') },
                  { value: 'keep', label: t('entity.io.modeKeep') },
                  { value: 'empty', label: t('entity.io.modeEmpty') },
                ]}
              />
              <SuggestInput
                className="min-w-0"
                inputClassName="font-mono text-[10px]"
                aria-label={`${field.name} Faker`}
                disabled={field.mode !== 'faker'}
                value={field.fakerKey ?? ''}
                onChange={(next) => updateField(field.name, { fakerKey: next })}
                placeholder="$faker.person.firstName"
                filter="includes"
                minListWidth={240}
                suggestions={suggestionsForAnonymizeField(field.name, fakerCatalog)}
                groupLabels={fakerGroupLabels}
              />
            </div>
          ))}
        </EntityIoPanel>

        <EntityIoPanel
          icon={Eye}
          title={t('entity.io.preview')}
          count={preview.length}
          contentClassName="p-0"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              disabled={!hasEntitySet || loading}
              onClick={() => void loadPreview()}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('entity.analyze.refresh')}
            </Button>
          }
        >
          {previewText ? (
            <EntityIoCodePreview
              value={previewText}
              language={getEntityIoFormat(formatId)?.language ?? 'plaintext'}
            />
          ) : (
            <p className="p-2 text-muted-foreground text-xs">{t('entity.io.anonymizeNoPreview')}</p>
          )}
        </EntityIoPanel>
      </EntityIoDialogFrame>
    </Dialog>
  )
}
