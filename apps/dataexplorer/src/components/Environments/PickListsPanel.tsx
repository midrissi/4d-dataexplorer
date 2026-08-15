import { Badge, Button, Input } from '@4d/ui'
import { CircleAlert, List, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EntityIoPanel } from '~/components/EntityIo/EntityIoPanel'
import { EntityIoSelect, type EntityIoSelectOption } from '~/components/EntityIo/EntityIoSelect'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { analyzableAttributes, type EntityIoAttribute } from '~/lib/entity-io'
import {
  createEmptyPickListDeclaration,
  ensureCurrentPickLists,
  isValidPickListName,
  type PickListDeclaration,
} from '~/lib/env'
import { useEnvironmentsStore } from '~/store/environments'

export function PickListsPanel() {
  const { t } = useTranslation()
  const revision = useEnvironmentsStore((s) => s.revision)
  const getPickLists = useEnvironmentsStore((s) => s.getPickLists)
  const setPickLists = useEnvironmentsStore((s) => s.setPickLists)
  const getPickListValuesState = useEnvironmentsStore((s) => s.getPickListValuesState)
  const invalidatePickListValues = useEnvironmentsStore((s) => s.invalidatePickListValues)
  void revision

  const entries = getPickLists()
  const [dataclassNames, setDataclassNames] = useState<string[]>([])
  const [attrsByDc, setAttrsByDc] = useState<Record<string, EntityIoAttribute[]>>({})
  const [pkByDc, setPkByDc] = useState<Record<string, string | undefined>>({})
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

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

  const dataclassOptions = useMemo((): EntityIoSelectOption<string>[] => {
    const options = dataclassNames.map((name) => ({ value: name, label: name }))
    if (!options.some((o) => o.value === '')) {
      options.unshift({ value: '', label: t('environments.pickListsDataclass') })
    }
    return options
  }, [dataclassNames, t])

  const patchEntry = useCallback(
    (id: string, patch: Partial<PickListDeclaration>) => {
      setPickLists(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
    },
    [entries, setPickLists]
  )

  const handleDataclassChange = useCallback(
    async (id: string, dataclass: string) => {
      if (!dataclass) {
        patchEntry(id, { dataclass: '', attribute: '' })
        return
      }
      try {
        const { attrs, key } = await loadSchema(dataclass)
        patchEntry(id, {
          dataclass,
          attribute: key ?? attrs[0]?.name ?? '',
        })
      } catch {
        patchEntry(id, { dataclass, attribute: '' })
      }
    },
    [loadSchema, patchEntry]
  )

  const refreshEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((item) => item.id === id)
      if (!entry?.name.trim() || !entry.dataclass || !entry.attribute) return
      invalidatePickListValues(entry.dataclass, entry.attribute)
      setRefreshingId(id)
      try {
        await ensureCurrentPickLists([entry.name.trim()])
      } finally {
        setRefreshingId(null)
      }
    },
    [entries, invalidatePickListValues]
  )

  const addEntry = useCallback(() => {
    setPickLists([...entries, createEmptyPickListDeclaration()])
  }, [entries, setPickLists])

  const removeEntry = useCallback(
    (id: string) => {
      const removed = entries.find((e) => e.id === id)
      if (removed?.dataclass && removed.attribute) {
        invalidatePickListValues(removed.dataclass, removed.attribute)
      }
      setPickLists(entries.filter((entry) => entry.id !== id))
    },
    [entries, invalidatePickListValues, setPickLists]
  )

  return (
    <EntityIoPanel
      icon={List}
      title={t('environments.pickLists')}
      count={entries.length}
      collapsible
      defaultCollapsed
      expandLabel={t('entity.expandPanel')}
      collapseLabel={t('entity.collapsePanel')}
      className="rounded-none border-0 border-border/60 border-t"
      contentClassName="max-h-56 space-y-1.5 overflow-auto overscroll-contain p-2"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          onClick={addEntry}
        >
          <Plus className="h-3 w-3" />
          {t('environments.pickListsAdd')}
        </Button>
      }
    >
      <p
        className="truncate px-0.5 text-[10px] text-muted-foreground"
        title={
          entries.length === 0
            ? t('environments.pickListsEmptyHint')
            : t('environments.pickListsUsageHint')
        }
      >
        {entries.length === 0
          ? t('environments.pickListsEmptyHint')
          : t('environments.pickListsUsageHint')}
      </p>
      {entries.length === 0
        ? null
        : entries.map((entry) => {
            const attrs = attrsByDc[entry.dataclass] ?? []
            const attributeOptions: EntityIoSelectOption<string>[] = [
              ...(entry.attribute && !attrs.some((a) => a.name === entry.attribute)
                ? [{ value: entry.attribute, label: entry.attribute }]
                : []),
              ...attrs.map((attr) => ({ value: attr.name, label: attr.name })),
            ]
            if (attributeOptions.length === 0) {
              attributeOptions.push({
                value: '',
                label: t('environments.pickListsAttribute'),
              })
            }
            const valuesState =
              entry.dataclass && entry.attribute
                ? getPickListValuesState(entry.dataclass, entry.attribute)
                : { status: 'idle' as const }
            const loading = refreshingId === entry.id || valuesState.status === 'loading'
            const nameOk = !entry.name.trim() || isValidPickListName(entry.name)
            const preview =
              valuesState.status === 'ready'
                ? `${valuesState.values.slice(0, 4).join(', ')}${
                    valuesState.values.length > 4 ? `, …(+${valuesState.values.length - 4})` : ''
                  }`
                : null
            return (
              <div
                key={entry.id}
                className="grid min-h-9 grid-cols-[minmax(6rem,0.8fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1.15fr)_auto] items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-1.5 py-1 transition-colors hover:bg-muted/20"
              >
                <Input
                  className="h-7 min-w-0 font-mono text-[10px]"
                  aria-label={t('environments.pickListsName')}
                  placeholder="companyKeys"
                  value={entry.name}
                  aria-invalid={!nameOk}
                  onChange={(event) => patchEntry(entry.id, { name: event.target.value })}
                />
                <EntityIoSelect
                  ariaLabel={t('environments.pickListsDataclass')}
                  value={entry.dataclass}
                  onValueChange={(dataclass) => void handleDataclassChange(entry.id, dataclass)}
                  options={dataclassOptions}
                  className="h-7 min-w-0 font-mono text-[10px]"
                />
                <EntityIoSelect
                  ariaLabel={t('environments.pickListsAttribute')}
                  value={entry.attribute}
                  disabled={!entry.dataclass}
                  onValueChange={(attribute) => {
                    if (entry.dataclass && entry.attribute) {
                      invalidatePickListValues(entry.dataclass, entry.attribute)
                    }
                    patchEntry(entry.id, { attribute })
                  }}
                  options={attributeOptions}
                  className="h-7 min-w-0 font-mono text-[10px]"
                />
                <div
                  className="flex min-w-0 items-center gap-1.5 overflow-hidden"
                  title={
                    !nameOk
                      ? t('environments.pickListsNameInvalid')
                      : valuesState.status === 'error'
                        ? valuesState.message
                        : (preview ?? undefined)
                  }
                >
                  {!nameOk ? (
                    <>
                      <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
                      <span className="truncate text-[10px] text-destructive">
                        {t('environments.pickListsNameInvalid')}
                      </span>
                    </>
                  ) : valuesState.status === 'ready' ? (
                    <>
                      <Badge
                        variant="muted"
                        className="h-5 shrink-0 px-1.5 py-0 font-mono text-[9px] tabular-nums"
                      >
                        {valuesState.values.length}
                        {valuesState.truncated
                          ? ` · ${t('environments.pickListsTruncated')}`
                          : null}
                      </Badge>
                      <span className="truncate font-mono text-[9px] text-muted-foreground">
                        {preview}
                      </span>
                    </>
                  ) : valuesState.status === 'empty' ? (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {t('environments.pickListsEmpty')}
                    </span>
                  ) : valuesState.status === 'error' ? (
                    <>
                      <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
                      <span className="truncate text-[10px] text-destructive">
                        {valuesState.message}
                      </span>
                    </>
                  ) : (
                    <span className="truncate font-mono text-[9px] text-muted-foreground/70">
                      {entry.dataclass && entry.attribute
                        ? `${entry.dataclass}.${entry.attribute}`
                        : '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-label={t('environments.pickListsLoad')}
                    title={t('environments.pickListsLoad')}
                    disabled={
                      !entry.name.trim() ||
                      !entry.dataclass ||
                      !entry.attribute ||
                      loading ||
                      !nameOk
                    }
                    onClick={() => void refreshEntry(entry.id)}
                  >
                    {loading ? (
                      <span className="animate-spin">
                        <Loader2 className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={t('environments.pickListsRemove')}
                    title={t('environments.pickListsRemove')}
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
                {!nameOk ? (
                  <span className="sr-only" role="alert">
                    {t('environments.pickListsNameInvalid')}
                  </span>
                ) : null}
              </div>
            )
          })}
    </EntityIoPanel>
  )
}
