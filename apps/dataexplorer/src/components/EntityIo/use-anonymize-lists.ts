import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import type { AnonymizeFieldPlan } from '~/lib/entity-io'
import {
  collectInlineListRefs,
  collectPickListNamesFromPlan,
  ensureCurrentPickLists,
  loadInlineListRefs,
} from '~/lib/env'
import { useEnvironmentsStore } from '~/store/environments'
import { mergeReadyLists } from './anonymize-dialog-helpers'

export type EnsureReferencedListsResult =
  | { lists: Record<string, readonly string[]>; ok: true }
  | { lists: Record<string, readonly string[]>; ok: false; message: string; detail?: string }

export function useAnonymizeLists({
  open,
  plan,
  planFakerTemplates,
}: {
  open: boolean
  plan: AnonymizeFieldPlan[]
  planFakerTemplates: string[]
}) {
  const { t } = useTranslation()
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

  const resetLists = useCallback(() => setListsReady({}), [])

  const ensureReferencedLists = useCallback(async (): Promise<EnsureReferencedListsResult> => {
    // Inline `ds.Dataclass.Attribute` refs load their distinct values on demand.
    const templates = planFakerTemplates
    const inlineRefs = collectInlineListRefs(templates)
    const inlineLists = await loadInlineListRefs(templates)
    if (Object.keys(inlineLists).length > 0) {
      setListsReady((prev) => mergeReadyLists(prev, inlineLists))
    }
    const missingInline = inlineRefs.find((ref) => !inlineLists[ref.key]?.length)
    if (missingInline) {
      return {
        lists: { ...getPickListsResolveMap(), ...inlineLists },
        ok: false,
        message: t('environments.pickListsLoadFailed', { name: missingInline.key }),
      }
    }

    const names = collectPickListNamesFromPlan(plan)
    if (names.length === 0) {
      return { lists: { ...getPickListsResolveMap(), ...inlineLists }, ok: true }
    }
    const result = await ensureCurrentPickLists(names)
    setListsReady((prev) => mergeReadyLists(prev, result.lists))
    const mergedLists = { ...result.lists, ...inlineLists }
    if (result.errors.length > 0) {
      const first = result.errors[0]
      return {
        lists: mergedLists,
        ok: false,
        message: t('environments.pickListsLoadFailed', { name: first?.name ?? '' }),
        detail: first?.message,
      }
    }
    if (result.missing.length > 0) {
      return {
        lists: mergedLists,
        ok: false,
        message: t('environments.pickListsMissing', { name: result.missing[0] ?? '' }),
      }
    }
    return { lists: mergedLists, ok: true }
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

  return {
    anonymizeLists,
    anonymizeListNames,
    ensureReferencedLists,
    resetLists,
  }
}
