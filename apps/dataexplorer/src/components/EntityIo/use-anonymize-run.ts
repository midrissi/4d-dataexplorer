import type { ConfirmOptions } from '@4d/ui'
import { useToast } from '@4d/ui'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { downloadBytes } from '~/lib/download-bytes'
import {
  type AnonymizeFieldPlan,
  anonymizeEntitiesWithProgress,
  defaultFilename,
  type EntityIoFormatId,
  getEntityIoFormat,
  isImageAnonymizeField,
  prepareAnonymizedUpdate,
  stripForCreate,
  uploadAnonymizedImages,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import { isAnonymizeAbortError, parseAnonymizeSeed } from './anonymize-dialog-helpers'
import type { AnonymizeProgress } from './EntityIoAnonymizeProgress'
import type { EnsureReferencedListsResult } from './use-anonymize-lists'

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

export function useAnonymizeRun({
  target,
  plan,
  seed,
  formatId,
  primaryKey,
  confirm,
  onOpenChange,
  ensureReferencedLists,
}: {
  target: EntityIoTarget | null
  plan: AnonymizeFieldPlan[]
  seed: string
  formatId: EntityIoFormatId
  primaryKey: string | undefined
  confirm: ConfirmFn
  onOpenChange: (open: boolean) => void
  ensureReferencedLists: () => Promise<EnsureReferencedListsResult>
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<AnonymizeProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    const entities = fetched.entities as Record<string, unknown>[]
    setProgress({ phase: 'anonymizing', current: 0, total: entities.length })
    const anonymized = await anonymizeEntitiesWithProgress(
      entities,
      {
        plan,
        seed: parseAnonymizeSeed(seed),
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

  const showFinalizingProgress = async (signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException('Anonymization cancelled', 'AbortError')
    setProgress({ phase: 'finalizing' })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (signal.aborted) throw new DOMException('Anonymization cancelled', 'AbortError')
  }

  const runWithAbort = async (work: (signal: AbortSignal) => Promise<void>) => {
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      await work(controller.signal)
    } catch (err) {
      if (isAnonymizeAbortError(err)) return
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

  const handleDownload = async () => {
    if (!target) return
    const format = getEntityIoFormat(formatId)
    if (!format) return
    await runWithAbort(async (signal) => {
      const rows = await fetchAnonymized(signal)
      await showFinalizingProgress(signal)
      const text = format.serialize(
        rows.map((r) => stripForCreate(r, primaryKey, plan)),
        { dataclassName: target.dataclassName }
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
    })
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

    await runWithAbort(async (signal) => {
      const rows = await fetchAnonymized(signal)
      await showFinalizingProgress(signal)
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
    })
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

    await runWithAbort(async (signal) => {
      const rows = await fetchAnonymized(signal)
      await showFinalizingProgress(signal)
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
    })
  }

  return {
    busy,
    progress,
    cancelAnonymization,
    handleDownload,
    handleImport,
    handleUpdateExisting,
  }
}
