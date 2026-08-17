import { useConfirm } from '@4d/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { analyzableAttributes, type EntityIoAttribute } from '~/lib/entity-io'
import {
  createEmptyDataclassPickList,
  ensureCurrentPickLists,
  isDataclassPickList,
  isValidPickListName,
  type PickListDeclaration,
  type PickListKind,
  type PickListScope,
} from '~/lib/env'
import { getCurrentBaseId } from '~/lib/storage'
import { useListsStore } from '~/store/lists'
import {
  type ListTransferMode,
  listTransferTargets,
  transferListToScope,
} from './list-scope-transfer'

export function useListsEditor(
  scope: PickListScope,
  opts?: { onMovedTo?: (scope: PickListScope) => void }
) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const revision = useListsStore((s) => s.revision)
  const getLists = useListsStore((s) => s.getLists)
  const setLists = useListsStore((s) => s.setLists)
  const getListValuesState = useListsStore((s) => s.getListValuesState)
  const invalidatePickList = useListsStore((s) => s.invalidatePickList)
  void revision

  const hasBase = Boolean(getCurrentBaseId())
  const onMovedTo = opts?.onMovedTo

  const entries = getLists(scope)
  const [dataclassNames, setDataclassNames] = useState<string[]>([])
  const [attrsByDc, setAttrsByDc] = useState<Record<string, EntityIoAttribute[]>>({})
  const [pkByDc, setPkByDc] = useState<Record<string, string | undefined>>({})
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const pendingFocusId = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api.getDataclassList().then((list) => {
      if (cancelled) return
      setDataclassNames([...list.map((dc) => dc.name)].sort((a, b) => a.localeCompare(b)))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loadSchema = useCallback(
    async (dataclass: string) => {
      if (!dataclass) {
        return { attrs: [] as EntityIoAttribute[], key: undefined as string | undefined }
      }
      const cached = attrsByDc[dataclass]
      if (cached) return { attrs: cached, key: pkByDc[dataclass] }
      const schema = await api.getDataclassSchema(dataclass)
      const attrs = analyzableAttributes(schema.attributes as EntityIoAttribute[])
      setAttrsByDc((prev) => ({ ...prev, [dataclass]: attrs }))
      setPkByDc((prev) => ({ ...prev, [dataclass]: schema.key }))
      return { attrs, key: schema.key }
    },
    [attrsByDc, pkByDc]
  )

  const dataclassOptions = useMemo(() => {
    const options = dataclassNames.map((name) => ({ value: name, label: name }))
    if (!options.some((o) => o.value === '')) {
      options.unshift({ value: '', label: t('lists.dataclass') })
    }
    return options
  }, [dataclassNames, t])

  const replaceEntry = useCallback(
    (id: string, next: PickListDeclaration) => {
      setLists(
        scope,
        getLists(scope).map((entry) => (entry.id === id ? next : entry))
      )
    },
    [getLists, scope, setLists]
  )

  const handleTypeChange = useCallback(
    (id: string, type: PickListKind) => {
      const entry = entries.find((item) => item.id === id)
      if (!entry || entry.type === type) return
      if (type === 'hardcoded') {
        if (isDataclassPickList(entry) && entry.dataclass && entry.attribute) {
          invalidatePickList(entry.id)
        }
        replaceEntry(id, {
          id: entry.id,
          name: entry.name,
          type: 'hardcoded',
          values: [],
        })
        return
      }
      replaceEntry(id, {
        id: entry.id,
        name: entry.name,
        type: 'dataclass',
        dataclass: '',
        attribute: '',
      })
    },
    [entries, invalidatePickList, replaceEntry]
  )

  const handleDataclassChange = useCallback(
    async (id: string, dataclass: string) => {
      const entry = entries.find((item) => item.id === id)
      if (!entry || !isDataclassPickList(entry)) return
      if (entry.dataclass && entry.attribute) invalidatePickList(entry.id)
      if (!dataclass) {
        replaceEntry(id, { ...entry, dataclass: '', attribute: '' })
        return
      }
      try {
        const { attrs, key } = await loadSchema(dataclass)
        replaceEntry(id, {
          ...entry,
          dataclass,
          attribute: key ?? attrs[0]?.name ?? '',
        })
      } catch {
        replaceEntry(id, { ...entry, dataclass, attribute: '' })
      }
    },
    [entries, invalidatePickList, loadSchema, replaceEntry]
  )

  const refreshEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((item) => item.id === id)
      if (!entry || !isDataclassPickList(entry)) return
      if (!entry.name.trim() || !entry.dataclass || !entry.attribute) return
      invalidatePickList(entry.id)
      setRefreshingId(id)
      try {
        await ensureCurrentPickLists([entry.name.trim()])
      } finally {
        setRefreshingId(null)
      }
    },
    [entries, invalidatePickList]
  )

  const addEntry = useCallback(() => {
    const next = createEmptyDataclassPickList()
    pendingFocusId.current = next.id
    setLists(scope, [...getLists(scope), next])
  }, [getLists, scope, setLists])

  const removeEntry = useCallback(
    (id: string) => {
      const current = getLists(scope)
      const removed = current.find((e) => e.id === id)
      if (removed && isDataclassPickList(removed)) {
        invalidatePickList(removed.id)
      }
      setLists(
        scope,
        current.filter((entry) => entry.id !== id)
      )
    },
    [getLists, invalidatePickList, scope, setLists]
  )

  const removeAllEntriesExcept = useCallback(
    async (id: string) => {
      const entry = entries.find((item) => item.id === id)
      const name = entry?.name.trim() || t('lists.newEntry')
      const ok = await confirm({
        title: t('lists.keepOnlyConfirmTitle'),
        description: t('lists.keepOnlyConfirmDescription', { name }),
        confirmText: t('lists.keepOnlyConfirm'),
        cancelText: t('entity.cancel'),
        variant: 'destructive',
      })
      if (!ok) return
      for (const item of entries) {
        if (item.id !== id && isDataclassPickList(item)) invalidatePickList(item.id)
      }
      setLists(
        scope,
        entries.filter((item) => item.id === id)
      )
    },
    [confirm, entries, invalidatePickList, scope, setLists, t]
  )

  const scopeLabel = useCallback(
    (value: PickListScope) => {
      if (value === 'globals') return t('lists.globals')
      if (value === 'profile') return t('lists.profile')
      return t('lists.base')
    },
    [t]
  )

  const transferTargets = useMemo(
    () =>
      listTransferTargets(scope, hasBase).map((value) => ({
        value,
        label: scopeLabel(value),
      })),
    [hasBase, scope, scopeLabel]
  )

  const transferEntry = useCallback(
    async (id: string, target: PickListScope, mode: ListTransferMode) => {
      const entry = entries.find((item) => item.id === id)
      if (!entry || target === scope) return
      const targetLists = getLists(target)
      const name = entry.name.trim()
      if (
        mode === 'move' &&
        name &&
        isValidPickListName(name) &&
        targetLists.some((item) => item.name.trim() === name)
      ) {
        const label = scopeLabel(target)
        const ok = await confirm({
          title: t('lists.moveReplaceConfirmTitle', { name, scope: label }),
          description: t('lists.moveReplaceConfirmDescription', { name, scope: label }),
          confirmText: t('lists.moveReplaceConfirm'),
          cancelText: t('entity.cancel'),
          variant: 'destructive',
        })
        if (!ok) return
      }
      const result = transferListToScope({
        mode,
        entry,
        sourceLists: entries,
        targetLists,
      })
      if (result.replaced && isDataclassPickList(result.replaced)) {
        invalidatePickList(result.replaced.id)
      }
      pendingFocusId.current = result.clone.id
      if (mode === 'move') setLists(scope, result.sourceLists)
      setLists(target, result.targetLists)
      onMovedTo?.(target)
    },
    [confirm, entries, getLists, invalidatePickList, onMovedTo, scope, scopeLabel, setLists, t]
  )

  return {
    entries,
    attrsByDc,
    refreshingId,
    pendingFocusId,
    dataclassOptions,
    getListValuesState,
    invalidatePickList,
    ConfirmDialog,
    addEntry,
    replaceEntry,
    handleTypeChange,
    handleDataclassChange,
    refreshEntry,
    removeEntry,
    removeAllEntriesExcept,
    transferTargets,
    transferEntry,
  }
}
