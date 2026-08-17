import type { ConfirmOptions } from '@4d/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  type AnonymizeFieldPlan,
  buildAnonymizeFieldPlan,
  type EntityIoAttribute,
  parseAnonymizeFieldPlan,
} from '~/lib/entity-io'
import type { EntityIoSelectOption } from './EntityIoSelect'

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

export function useAnonymizePlan({
  mappableAttributes,
  confirm,
}: {
  mappableAttributes: EntityIoAttribute[]
  confirm: ConfirmFn
}) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<AnonymizeFieldPlan[]>([])
  const [planView, setPlanView] = useState<'form' | 'json'>('form')
  const [planJsonDraft, setPlanJsonDraft] = useState('[]')
  const [planJsonError, setPlanJsonError] = useState(false)

  const hasAnonymizedFields = plan.some((field) => field.mode !== 'keep')
  const plannedNames = useMemo(() => new Set(plan.map((field) => field.name)), [plan])
  const availableToAdd = useMemo(
    () => mappableAttributes.filter((attr) => !plannedNames.has(attr.name)),
    [mappableAttributes, plannedNames]
  )
  const planJson = useMemo(() => JSON.stringify(plan, null, 2), [plan])
  const planFakerTemplates = useMemo(
    () =>
      plan
        .filter((field) => field.mode === 'faker' && field.fakerKey)
        .map((field) => field.fakerKey as string),
    [plan]
  )

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

  return {
    plan,
    setPlan,
    planView,
    setPlanView,
    planJson,
    planJsonDraft,
    planJsonError,
    planFakerTemplates,
    hasAnonymizedFields,
    availableToAdd,
    updatePlanJson,
    applyPlanJson,
    updateField,
    removeField,
    removeAllFieldsExcept,
    addField,
    replaceField,
    resetPlan,
    clearPlan,
    fieldOptionsFor,
  }
}
