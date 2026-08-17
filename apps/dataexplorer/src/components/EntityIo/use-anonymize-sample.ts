import { useToast } from '@4d/ui'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  type AnonymizeFieldPlan,
  anonymizeEntities,
  type EntityIoAttribute,
  type EntityIoFormatId,
  getEntityIoFormat,
  stripForCreate,
} from '~/lib/entity-io'
import { fetchAnonymizeSampleRows, parseAnonymizeSeed } from './anonymize-dialog-helpers'

export function useAnonymizeSample({
  open,
  dataclassName,
  entitySetId,
  plan,
  seed,
  formatId,
  primaryKey,
  mappableAttributes,
  lists,
}: {
  open: boolean
  dataclassName: string
  entitySetId: string
  plan: AnonymizeFieldPlan[]
  seed: string
  formatId: EntityIoFormatId
  primaryKey: string | undefined
  mappableAttributes: EntityIoAttribute[]
  lists: Record<string, readonly string[]>
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const deferredPreviewPlan = useDeferredValue(plan)
  const hasEntitySet = Boolean(entitySetId)

  const anonymizeThisRoot = useMemo(
    () => ({
      ...Object.fromEntries(mappableAttributes.map((attr) => [attr.name, undefined])),
      ...sampleRows[0],
    }),
    [mappableAttributes, sampleRows]
  )

  const loadSample = useCallback(async () => {
    if (!dataclassName || !entitySetId) return
    setLoading(true)
    try {
      const rows = await fetchAnonymizeSampleRows(dataclassName, entitySetId)
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
  }, [dataclassName, entitySetId, t, toast])

  useEffect(() => {
    if (!open || !hasEntitySet || !dataclassName || !entitySetId) return
    let cancelled = false
    setLoading(true)
    void fetchAnonymizeSampleRows(dataclassName, entitySetId)
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
  }, [open, hasEntitySet, dataclassName, entitySetId, t, toast])

  const preview = useMemo(() => {
    if (sampleRows.length === 0 || deferredPreviewPlan.length === 0) return []
    return anonymizeEntities(sampleRows, {
      plan: deferredPreviewPlan,
      seed: parseAnonymizeSeed(seed),
      lists,
    })
  }, [sampleRows, deferredPreviewPlan, seed, lists])

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

  return {
    loading,
    preview,
    previewText,
    anonymizeThisRoot,
    loadSample,
  }
}
