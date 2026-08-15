import {
  Button,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
  useToast,
} from '@4d/ui'
import {
  ChevronDown,
  Download,
  Eye,
  Info,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type TextPreviewMode, TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { downloadBytes } from '~/lib/download-bytes'
import {
  type AnonymizeFieldMode,
  type AnonymizeFieldPlan,
  anonymizeEntities,
  buildAnonymizeFieldPlan,
  buildDefaultAnonymizePlan,
  defaultFilename,
  type EntityIoAttribute,
  type EntityIoFormatId,
  getEntityIoFormat,
  listAnonymizeMappableAttributes,
  listExportFormats,
  prepareAnonymizedUpdate,
  stripForCreate,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import { AnonymizeFieldRow } from './AnonymizeFieldRow'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect, type EntityIoSelectOption } from './EntityIoSelect'

function previewModeForFormat(formatId: EntityIoFormatId): TextPreviewMode {
  switch (formatId) {
    case 'json':
    case 'json-rest':
      return 'json'
    case 'csv':
    case 'tsv':
      return 'csv'
    case 'html':
      return 'html'
    case 'markdown':
      return 'markdown'
    default:
      return 'code'
  }
}

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
  const { confirm, ConfirmDialog } = useConfirm()
  const formats = useMemo(() => listExportFormats(), [])
  const [plan, setPlan] = useState<AnonymizeFieldPlan[]>([])
  const [mappableAttributes, setMappableAttributes] = useState<EntityIoAttribute[]>([])
  const [primaryKey, setPrimaryKey] = useState<string | undefined>()
  const [seed, setSeed] = useState('')
  const [formatId, setFormatId] = useState<EntityIoFormatId>('json')
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const modeOptions = useMemo(
    (): EntityIoSelectOption<AnonymizeFieldMode>[] => [
      { value: 'faker', label: t('entity.io.modeFaker') },
      { value: 'fixed', label: t('entity.io.modeFixed') },
      { value: 'keep', label: t('entity.io.modeKeep') },
      { value: 'empty', label: t('entity.io.modeEmpty') },
    ],
    [t]
  )

  const dataclassName = target?.dataclassName ?? ''
  const hasEntitySet = Boolean(target?.entitySetId?.trim())
  const hasAnonymizedFields = plan.some((field) => field.mode !== 'keep')
  const plannedNames = useMemo(() => new Set(plan.map((field) => field.name)), [plan])
  const availableToAdd = useMemo(
    () => mappableAttributes.filter((attr) => !plannedNames.has(attr.name)),
    [mappableAttributes, plannedNames]
  )
  const anonymizeThisRoot = useMemo(
    () => ({
      ...Object.fromEntries(mappableAttributes.map((attr) => [attr.name, undefined])),
      ...sampleRows[0],
    }),
    [mappableAttributes, sampleRows]
  )

  useEffect(() => {
    if (!open || !dataclassName) return
    let cancelled = false
    void api.getDataclassSchema(dataclassName).then((schema) => {
      if (cancelled) return
      const attrs = listAnonymizeMappableAttributes(
        schema.attributes as EntityIoAttribute[],
        schema.key
      )
      setPrimaryKey(schema.key)
      setMappableAttributes(attrs)
      setPlan(buildDefaultAnonymizePlan(schema.attributes as EntityIoAttribute[], schema.key))
    })
    return () => {
      cancelled = true
    }
  }, [open, dataclassName])

  const updateField = useCallback((name: string, patch: Partial<AnonymizeFieldPlan>) => {
    setPlan((prev) => prev.map((f) => (f.name === name ? { ...f, ...patch } : f)))
  }, [])

  const removeField = useCallback((name: string) => {
    setPlan((prev) => prev.filter((f) => f.name !== name))
  }, [])

  const addField = useCallback(
    (attrName: string) => {
      setPlan((prev) => {
        if (prev.some((field) => field.name === attrName)) return prev
        const attr = mappableAttributes.find((item) => item.name === attrName)
        if (!attr) return prev
        return [...prev, buildAnonymizeFieldPlan(attr)]
      })
    },
    [mappableAttributes]
  )

  const replaceField = useCallback(
    (from: string, to: string) => {
      setPlan((prev) => {
        if (from === to) return prev
        if (prev.some((field) => field.name === to)) return prev
        const attr = mappableAttributes.find((item) => item.name === to)
        if (!attr) return prev
        const next = buildAnonymizeFieldPlan(attr)
        return prev.map((field) => (field.name === from ? next : field))
      })
    },
    [mappableAttributes]
  )

  const resetPlan = useCallback(() => {
    setPlan(mappableAttributes.map(buildAnonymizeFieldPlan))
  }, [mappableAttributes])

  const clearPlan = useCallback(() => {
    setPlan([])
  }, [])

  const fieldOptionsFor = useCallback(
    (currentName: string): EntityIoSelectOption<string>[] => {
      return mappableAttributes
        .filter((attr) => attr.name === currentName || !plannedNames.has(attr.name))
        .map((attr) => ({ value: attr.name, label: attr.name }))
    },
    [mappableAttributes, plannedNames]
  )
  // Sample rows are fetched once per selection; editing the plan re-anonymizes them locally.
  const loadSample = useCallback(async () => {
    const entitySetId = target?.entitySetId?.trim()
    if (!target || !entitySetId) return
    setLoading(true)
    try {
      const page = await api.getEntities(target.dataclassName, {
        entitySetId,
        top: 5,
        page: 1,
      })
      setSampleRows(page.entities as Record<string, unknown>[])
    } catch (err) {
      toast({
        title: t('entity.io.anonymizePreviewFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [t, target?.dataclassName, target?.entitySetId, toast, target])

  useEffect(() => {
    if (open && hasEntitySet) void loadSample()
  }, [open, hasEntitySet, loadSample])

  const preview = useMemo(() => {
    if (sampleRows.length === 0 || plan.length === 0) return []
    const seedNum = seed.trim() ? Number(seed) : undefined
    return anonymizeEntities(sampleRows, {
      plan,
      seed: Number.isFinite(seedNum) ? seedNum : undefined,
    })
  }, [sampleRows, plan, seed])

  // Preview mirrors the download payload so the chosen format is what gets highlighted.
  const previewText = useMemo(() => {
    if (preview.length === 0) return ''
    const format = getEntityIoFormat(formatId)
    if (!format) return ''
    return format
      .serialize(
        preview.map((row) => stripForCreate(row, primaryKey, plan)),
        { dataclassName }
      )
      .trimEnd()
  }, [preview, formatId, primaryKey, dataclassName, plan])

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
        rows.map((r) => stripForCreate(r, primaryKey, plan)),
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

  const handleImport = async (removeExisting: boolean) => {
    if (!target) return
    const ok = await confirm({
      title: t(
        removeExisting
          ? 'entity.io.importAsNewReplaceConfirmTitle'
          : 'entity.io.importAsNewConfirmTitle'
      ),
      description: t(
        removeExisting
          ? 'entity.io.importAsNewReplaceConfirmDescription'
          : 'entity.io.importAsNewConfirmDescription',
        { dataclass: target.dataclassName }
      ),
      confirmText: t(
        removeExisting ? 'entity.io.importAsNewReplaceConfirm' : 'entity.io.importAsNewConfirm'
      ),
      cancelText: t('entity.cancel'),
      variant: removeExisting ? 'destructive' : undefined,
    })
    if (!ok) return

    setBusy(true)
    try {
      const rows = await fetchAnonymized()
      const prepared = rows.map((r) => stripForCreate(r, primaryKey, plan))
      if (removeExisting) {
        await api.deleteManyEntities(target.dataclassName)
      }
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

  const handleUpdateExisting = async () => {
    if (!target) return
    const ok = await confirm({
      title: t('entity.io.anonymizeExistingConfirmTitle'),
      description: t('entity.io.anonymizeExistingConfirmDescription', {
        dataclass: target.dataclassName,
      }),
      confirmText: t('entity.io.anonymizeExistingConfirm'),
      cancelText: t('entity.cancel'),
      variant: 'destructive',
    })
    if (!ok) return

    setBusy(true)
    try {
      const rows = await fetchAnonymized()
      const prepared = rows.map((row) => prepareAnonymizedUpdate(row, plan))
      const missing = prepared.filter((row) => row.__KEY == null || row.__STAMP == null)
      if (missing.length > 0) {
        throw new Error(t('entity.io.importMissingKeys', { count: missing.length }))
      }
      const result = await api.updateManyEntities(target.dataclassName, prepared)
      toast({
        title: t('entity.io.anonymizeExistingDone'),
        description: t('entity.io.anonymizeExistingDoneDescription', { count: result.count }),
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
    <>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !hasEntitySet || plan.length === 0}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <WandSparkles className="h-3.5 w-3.5" />
                    )}
                    {t('entity.io.anonymizeActions')}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => void handleDownload()}>
                    <Download />
                    {t('entity.io.download')}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0">
                      <Upload />
                      {t('entity.io.importAsNew')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuItem onSelect={() => void handleImport(false)}>
                        <Plus />
                        {t('entity.io.importKeepExisting')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onSelect={() => void handleImport(true)}
                      >
                        <Trash2 />
                        {t('entity.io.importReplaceExisting')}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    disabled={!hasAnonymizedFields}
                    onSelect={() => void handleUpdateExisting()}
                  >
                    <ShieldAlert />
                    {t('entity.io.anonymizeExisting')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <div className="grid items-start gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex h-4 items-center gap-1">
                  <Label htmlFor="anon-seed" className="leading-none">
                    {t('entity.io.seed')}
                  </Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      {/* Non-focusable trigger: dialog autofocus must not open the help. */}
                      <TooltipTrigger asChild>
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                          <Info className="h-3 w-3" aria-hidden />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {t('entity.io.seedHelp')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="anon-seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="42"
                  inputMode="numeric"
                  aria-describedby="anon-seed-help"
                />
                <p id="anon-seed-help" className="sr-only">
                  {t('entity.io.seedHelp')}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex h-4 items-center">
                  <Label htmlFor="anon-format" className="leading-none">
                    {t('entity.io.formatLabel')}
                  </Label>
                </div>
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
            action={
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground"
                  disabled={plan.length === 0}
                  onClick={clearPlan}
                >
                  <Trash2 className="h-3 w-3" />
                  {t('entity.io.removeAllFields')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground"
                  disabled={mappableAttributes.length === 0}
                  onClick={resetPlan}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('entity.io.resetFieldPlan')}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground"
                      disabled={availableToAdd.length === 0}
                    >
                      <Plus className="h-3 w-3" />
                      {t('entity.io.addField')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
                    {availableToAdd.map((attr) => (
                      <DropdownMenuItem
                        key={attr.name}
                        className="font-mono text-xs"
                        onSelect={() => addField(attr.name)}
                      >
                        {attr.name}
                        <span className="ml-2 text-muted-foreground">{attr.type}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          >
            {plan.length === 0 ? (
              <p className="p-2 text-muted-foreground text-xs">{t('entity.io.fieldPlanEmpty')}</p>
            ) : (
              plan.map((field) => (
                <AnonymizeFieldRow
                  key={field.name}
                  field={field}
                  fieldOptions={fieldOptionsFor(field.name)}
                  modeOptions={modeOptions}
                  fieldLabel={t('entity.io.fieldName')}
                  modeLabel={t('entity.io.importMode')}
                  removeLabel={t('entity.io.removeField')}
                  thisRoot={anonymizeThisRoot}
                  onFieldNameChange={replaceField}
                  onChange={updateField}
                  onRemove={removeField}
                />
              ))
            )}
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
                onClick={() => void loadSample()}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('entity.analyze.refresh')}
              </Button>
            }
          >
            {previewText ? (
              <TextPreviewPanel
                text={previewText}
                className="h-56 rounded-none border-0"
                initialMode={previewModeForFormat(formatId)}
                language={getEntityIoFormat(formatId)?.language}
              />
            ) : (
              <p className="p-2 text-muted-foreground text-xs">
                {t('entity.io.anonymizeNoPreview')}
              </p>
            )}
          </EntityIoPanel>
        </EntityIoDialogFrame>
      </Dialog>
      <ConfirmDialog />
    </>
  )
}
