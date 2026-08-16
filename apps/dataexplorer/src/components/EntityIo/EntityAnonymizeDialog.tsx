import {
  Button,
  ClickToCopy,
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
  SegmentedControl,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
  useToast,
} from '@4d/ui'
import {
  Braces,
  ChevronDown,
  Copy,
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
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { type TextPreviewMode, TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { downloadBytes } from '~/lib/download-bytes'
import {
  type AnonymizeFieldMode,
  type AnonymizeFieldPlan,
  anonymizeEntities,
  anonymizeEntitiesWithProgress,
  buildAnonymizeFieldPlan,
  buildDefaultAnonymizePlan,
  defaultFilename,
  type EntityIoAttribute,
  type EntityIoFormatId,
  getEntityIoFormat,
  isImageAnonymizeField,
  listAnonymizeMappableAttributes,
  listExportFormats,
  parseAnonymizeFieldPlan,
  prepareAnonymizedUpdate,
  stripForCreate,
  uploadAnonymizedImages,
} from '~/lib/entity-io'
import {
  collectInlineListRefs,
  collectPickListNamesFromPlan,
  ensureCurrentPickLists,
  loadInlineListRefs,
} from '~/lib/env'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import { useEnvironmentsStore } from '~/store/environments'
import { AnonymizeFieldRow } from './AnonymizeFieldRow'
import { type AnonymizeProgress, EntityIoAnonymizeProgress } from './EntityIoAnonymizeProgress'
import { EntityIoCodePreview } from './EntityIoCodePreview'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect, type EntityIoSelectOption } from './EntityIoSelect'

/** Keep the previous object identity when no new list values arrived. */
/** Keep one in-flight sample fetch per selection (covers Strict Mode remount). */
const anonymizeSampleInflight = new Map<string, Promise<Record<string, unknown>[]>>()

function fetchAnonymizeSampleRows(
  dataclassName: string,
  entitySetId: string
): Promise<Record<string, unknown>[]> {
  const key = `${dataclassName}\0${entitySetId}`
  const existing = anonymizeSampleInflight.get(key)
  if (existing) return existing
  const promise = api
    .getEntities(dataclassName, { entitySetId, top: 5, page: 1 })
    .then((page) => page.entities as Record<string, unknown>[])
    .finally(() => {
      if (anonymizeSampleInflight.get(key) === promise) {
        anonymizeSampleInflight.delete(key)
      }
    })
  anonymizeSampleInflight.set(key, promise)
  return promise
}

function mergeReadyLists(
  prev: Record<string, readonly string[]>,
  next: Record<string, readonly string[]>
): Record<string, readonly string[]> {
  for (const [name, values] of Object.entries(next)) {
    if (prev[name] !== values) return { ...prev, ...next }
  }
  return prev
}

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
  const [planView, setPlanView] = useState<'form' | 'json'>('form')
  const [planJsonDraft, setPlanJsonDraft] = useState('[]')
  const [planJsonError, setPlanJsonError] = useState(false)
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<AnonymizeProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [listsReady, setListsReady] = useState<Record<string, readonly string[]>>({})

  const envRevision = useEnvironmentsStore((s) => s.revision)
  const getPickListNames = useEnvironmentsStore((s) => s.getPickListNames)
  const getPickListsResolveMap = useEnvironmentsStore((s) => s.getPickListsResolveMap)
  // Both read base settings from localStorage, so keep them memoized per revision:
  // fresh arrays/objects on every render would also invalidate the row suggestion caches.
  const anonymizeListNames = useMemo(() => {
    void envRevision
    return getPickListNames()
  }, [getPickListNames, envRevision])
  const anonymizeLists = useMemo(() => {
    void envRevision
    const fromStore = getPickListsResolveMap()
    return { ...fromStore, ...listsReady }
  }, [getPickListsResolveMap, listsReady, envRevision])

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
  const closeForManageVariables = useCallback(() => onOpenChange(false), [onOpenChange])
  const hasAnonymizedFields = plan.some((field) => field.mode !== 'keep')
  const plannedNames = useMemo(() => new Set(plan.map((field) => field.name)), [plan])
  const availableToAdd = useMemo(
    () => mappableAttributes.filter((attr) => !plannedNames.has(attr.name)),
    [mappableAttributes, plannedNames]
  )
  const planJson = useMemo(() => JSON.stringify(plan, null, 2), [plan])
  const deferredPreviewPlan = useDeferredValue(plan)

  useEffect(() => {
    if (planView === 'json') return
    setPlanJsonDraft(planJson)
    setPlanJsonError(false)
  }, [planJson, planView])

  const updatePlanJson = useCallback((value: string) => {
    setPlanJsonDraft(value)
    try {
      const parsed = parseAnonymizeFieldPlan(JSON.parse(value) as unknown)
      setPlanJsonError(!parsed)
    } catch {
      setPlanJsonError(true)
    }
  }, [])

  const applyPlanJson = useCallback((): boolean => {
    try {
      const parsed = parseAnonymizeFieldPlan(JSON.parse(planJsonDraft) as unknown)
      if (!parsed) {
        setPlanJsonError(true)
        return false
      }
      setPlanJsonError(false)
      setPlan(parsed)
      return true
    } catch {
      setPlanJsonError(true)
      return false
    }
  }, [planJsonDraft])

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
      setListsReady({})
    })
    return () => {
      cancelled = true
    }
  }, [open, dataclassName])

  // Faker templates from the plan (source for inline `ds.Class.Attr` refs).
  const planFakerTemplates = useMemo(
    () =>
      plan
        .filter((field) => field.mode === 'faker' && field.fakerKey)
        .map((field) => field.fakerKey as string),
    [plan]
  )

  const ensureReferencedLists = useCallback(async () => {
    // Inline `ds.Dataclass.Attribute` refs load their distinct values on demand.
    const templates = planFakerTemplates
    const inlineLists = await loadInlineListRefs(templates)
    if (Object.keys(inlineLists).length > 0) {
      setListsReady((prev) => mergeReadyLists(prev, inlineLists))
    }

    const names = collectPickListNamesFromPlan(plan)
    if (names.length === 0) {
      return { lists: { ...getPickListsResolveMap(), ...inlineLists }, ok: true as const }
    }
    const result = await ensureCurrentPickLists(names)
    setListsReady((prev) => mergeReadyLists(prev, result.lists))
    const mergedLists = { ...result.lists, ...inlineLists }
    if (result.errors.length > 0) {
      const first = result.errors[0]
      return {
        lists: mergedLists,
        ok: false as const,
        message: t('environments.pickListsLoadFailed', { name: first?.name ?? '' }),
        detail: first?.message,
      }
    }
    if (result.missing.length > 0) {
      return {
        lists: mergedLists,
        ok: false as const,
        message: t('environments.pickListsMissing', { name: result.missing[0] ?? '' }),
      }
    }
    return { lists: mergedLists, ok: true as const }
  }, [plan, planFakerTemplates, getPickListsResolveMap, t])

  // Referenced `$lists` names as a stable key so typing inside a template that
  // already references the same lists does not re-trigger loading.
  const referencedListsKey = useMemo(
    () => collectPickListNamesFromPlan(plan).join('\u0000'),
    [plan]
  )

  // Stable key of inline `ds.Class.Attr` refs so preview loading only re-runs
  // when the referenced dataclass attributes actually change.
  const referencedInlineKey = useMemo(
    () =>
      collectInlineListRefs(planFakerTemplates)
        .map((ref) => ref.key)
        .sort()
        .join('\u0000'),
    [planFakerTemplates]
  )

  // Lazily load inline `ds.Class.Attr` distinct values so the preview resolves
  // (and mirrors what the download will generate).
  // biome-ignore lint/correctness/useExhaustiveDependencies: referencedInlineKey gates on the meaningful ref change
  useEffect(() => {
    if (!open || !referencedInlineKey) return
    let cancelled = false
    void loadInlineListRefs(planFakerTemplates).then((map) => {
      if (cancelled) return
      if (Object.keys(map).length > 0) setListsReady((prev) => mergeReadyLists(prev, map))
    })
    return () => {
      cancelled = true
    }
  }, [open, referencedInlineKey, envRevision])

  // Lazily ensure referenced pick lists.
  // envRevision: re-run when Environments declarations or cached values change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: envRevision intentionally invalidates this effect
  useEffect(() => {
    if (!open || !referencedListsKey) return
    const names = referencedListsKey.split('\u0000')
    let cancelled = false
    void ensureCurrentPickLists(names).then((result) => {
      if (cancelled) return
      setListsReady((prev) => mergeReadyLists(prev, result.lists))
    })
    return () => {
      cancelled = true
    }
  }, [open, referencedListsKey, envRevision])

  const updateField = useCallback((name: string, patch: Partial<AnonymizeFieldPlan>) => {
    setPlan((prev) => prev.map((f) => (f.name === name ? { ...f, ...patch } : f)))
  }, [])

  const removeField = useCallback((name: string) => {
    setPlan((prev) => prev.filter((f) => f.name !== name))
  }, [])

  const removeAllFieldsExcept = useCallback(
    async (name: string) => {
      const ok = await confirm({
        title: t('entity.io.keepOnlyFieldConfirmTitle'),
        description: t('entity.io.keepOnlyFieldConfirmDescription', { field: name }),
        confirmText: t('entity.io.keepOnlyFieldConfirm'),
        cancelText: t('entity.cancel'),
        variant: 'destructive',
      })
      if (ok) setPlan((prev) => prev.filter((field) => field.name === name))
    },
    [confirm, t]
  )

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
  const sampleEntitySetId = target?.entitySetId?.trim() ?? ''
  const loadSample = useCallback(async () => {
    if (!dataclassName || !sampleEntitySetId) return
    setLoading(true)
    try {
      const rows = await fetchAnonymizeSampleRows(dataclassName, sampleEntitySetId)
      setSampleRows(rows)
    } catch (err) {
      toast({
        title: t('entity.io.anonymizePreviewFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [dataclassName, sampleEntitySetId, t, toast])

  useEffect(() => {
    if (!open || !hasEntitySet || !dataclassName || !sampleEntitySetId) return
    let cancelled = false
    setLoading(true)
    void fetchAnonymizeSampleRows(dataclassName, sampleEntitySetId)
      .then((rows) => {
        if (cancelled) return
        setSampleRows(rows)
      })
      .catch((err) => {
        if (cancelled) return
        toast({
          title: t('entity.io.anonymizePreviewFailed'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, hasEntitySet, dataclassName, sampleEntitySetId, t, toast])

  const preview = useMemo(() => {
    if (sampleRows.length === 0 || deferredPreviewPlan.length === 0) return []
    const seedNum = seed.trim() ? Number(seed) : undefined
    return anonymizeEntities(sampleRows, {
      plan: deferredPreviewPlan,
      seed: Number.isFinite(seedNum) ? seedNum : undefined,
      lists: anonymizeLists,
    })
  }, [sampleRows, deferredPreviewPlan, seed, anonymizeLists])

  // Preview mirrors the download payload so the chosen format is what gets highlighted.
  const previewText = useMemo(() => {
    if (preview.length === 0) return ''
    const format = getEntityIoFormat(formatId)
    if (!format) return ''
    return format
      .serialize(
        preview.map((row) => stripForCreate(row, primaryKey, deferredPreviewPlan)),
        { dataclassName }
      )
      .trimEnd()
  }, [preview, formatId, primaryKey, dataclassName, deferredPreviewPlan])

  const fetchAnonymized = async (signal: AbortSignal) => {
    if (!target?.entitySetId?.trim()) throw new Error(t('entity.deleteManySelectionUnavailable'))
    const ensured = await ensureReferencedLists()
    if (!ensured.ok) {
      throw new Error(
        [ensured.message, 'detail' in ensured ? ensured.detail : undefined]
          .filter(Boolean)
          .join(': ')
      )
    }
    setProgress({ phase: 'fetching', current: 0, total: target.selectionCount ?? 0 })
    const fetched = await api.fetchAllEntities({
      dataclass: target.dataclassName,
      entitySetId: target.entitySetId,
      onProgress: (current, total) => setProgress({ phase: 'fetching', current, total }),
      signal,
    })
    const seedNum = seed.trim() ? Number(seed) : undefined
    const entities = fetched.entities as Record<string, unknown>[]
    setProgress({ phase: 'anonymizing', current: 0, total: entities.length })
    const anonymized = await anonymizeEntitiesWithProgress(
      entities,
      {
        plan,
        seed: Number.isFinite(seedNum) ? seedNum : undefined,
        lists: ensured.lists,
      },
      (current, total) => setProgress({ phase: 'anonymizing', current, total }),
      100,
      signal
    )
    const imageCount = plan.filter(isImageAnonymizeField).length
    if (imageCount === 0) return anonymized
    setProgress({ phase: 'uploading', current: 0, total: entities.length * imageCount })
    return uploadAnonymizedImages(
      anonymized,
      plan,
      (file) => api.uploadFile(file, true, signal),
      (current, total) => setProgress({ phase: 'uploading', current, total }),
      (url) => fetch(url, { signal }),
      undefined,
      signal
    )
  }

  const cancelAnonymization = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const wasCancelled = (error: unknown) =>
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')

  const showFinalizingProgress = async (signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException('Anonymization cancelled', 'AbortError')
    setProgress({ phase: 'finalizing' })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (signal.aborted) throw new DOMException('Anonymization cancelled', 'AbortError')
  }

  const handleDownload = async () => {
    if (!target) return
    const format = getEntityIoFormat(formatId)
    if (!format) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      const rows = await fetchAnonymized(controller.signal)
      await showFinalizingProgress(controller.signal)
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
      if (wasCancelled(err)) return
      toast({
        title: t('entity.io.anonymizeFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
      setProgress(null)
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

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      const rows = await fetchAnonymized(controller.signal)
      await showFinalizingProgress(controller.signal)
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
      if (wasCancelled(err)) return
      toast({
        title: t('entity.io.anonymizeFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
      setProgress(null)
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

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      const rows = await fetchAnonymized(controller.signal)
      await showFinalizingProgress(controller.signal)
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
      if (wasCancelled(err)) return
      toast({
        title: t('entity.io.anonymizeFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
      setProgress(null)
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
              <div className="min-w-0 flex-1">
                {progress ? (
                  <EntityIoAnonymizeProgress progress={progress} onCancel={cancelAnonymization} />
                ) : null}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
              </div>
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
                <TooltipProvider delayDuration={250}>
                  {planView === 'form' ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground"
                            disabled={plan.length === 0}
                            aria-label={t('entity.io.removeAllFields')}
                            onClick={clearPlan}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {t('entity.io.removeAllFields')}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground"
                            disabled={mappableAttributes.length === 0}
                            aria-label={t('entity.io.resetFieldPlan')}
                            onClick={resetPlan}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {t('entity.io.resetFieldPlan')}
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground"
                                disabled={availableToAdd.length === 0}
                                aria-label={t('entity.io.addField')}
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{t('entity.io.addField')}</TooltipContent>
                        </Tooltip>
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
                    </>
                  ) : (
                    <ClickToCopy
                      value={planJson}
                      tooltipLabel={t('entity.io.copyFieldPlan')}
                      tooltipCopiedLabel={t('common.copied')}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={t('entity.io.copyFieldPlan')}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </ClickToCopy>
                  )}
                </TooltipProvider>
                <SegmentedControl
                  value={planView}
                  onValueChange={(next) => {
                    if (planView === 'json' && next !== 'json' && !applyPlanJson()) return
                    setPlanView(next)
                  }}
                  aria-label={t('entity.io.fieldPlanView')}
                  className="ml-1 shrink-0"
                  options={[
                    { value: 'form', label: t('entity.io.fieldPlanForm'), icon: ListChecks },
                    { value: 'json', label: t('entity.io.fieldPlanJson'), icon: Braces },
                  ]}
                />
              </div>
            }
          >
            {planView === 'json' ? (
              <div>
                <EntityIoCodePreview
                  value={planJsonDraft}
                  language="json"
                  height={220}
                  onChange={updatePlanJson}
                  onBlur={applyPlanJson}
                />
                {planJsonError ? (
                  <p className="px-2 py-1 text-destructive text-xs" role="alert">
                    {t('entity.io.fieldPlanJsonInvalid')}
                  </p>
                ) : null}
              </div>
            ) : plan.length === 0 ? (
              <p className="p-2 text-muted-foreground text-xs">{t('entity.io.fieldPlanEmpty')}</p>
            ) : (
              <>
                {plan.map((field) => (
                  <AnonymizeFieldRow
                    key={field.name}
                    field={field}
                    fieldOptions={fieldOptionsFor(field.name)}
                    modeOptions={modeOptions}
                    fieldLabel={t('entity.io.fieldName')}
                    modeLabel={t('entity.io.importMode')}
                    removeLabel={t('entity.io.removeField')}
                    thisRoot={anonymizeThisRoot}
                    lists={anonymizeLists}
                    listNames={anonymizeListNames}
                    onManageVariables={closeForManageVariables}
                    onFieldNameChange={replaceField}
                    onChange={updateField}
                    onRemove={removeField}
                    onRemoveExcept={(name) => void removeAllFieldsExcept(name)}
                  />
                ))}
                <p className="border-border/50 border-t px-2 py-1.5 text-muted-foreground text-xs">
                  {t('entity.io.fieldPlanKeepOnlyHint')}
                </p>
              </>
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
