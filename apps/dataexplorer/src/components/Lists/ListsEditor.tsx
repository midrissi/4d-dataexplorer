import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@4d/ui'
import { CircleAlert, List, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyPanel as AppEmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { EntityIoSelect, type EntityIoSelectOption } from '~/components/EntityIo/EntityIoSelect'
import { ListTagsInput, serializeListParamTags } from '~/components/RequestKeyValue/ListTagsInput'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { analyzableAttributes, type EntityIoAttribute } from '~/lib/entity-io'
import {
  createEmptyDataclassPickList,
  ensureCurrentPickLists,
  isDataclassPickList,
  isHardcodedPickList,
  isValidPickListName,
  normalizeHardcodedValues,
  type PickListDeclaration,
  type PickListKind,
  type PickListScope,
} from '~/lib/env'
import { useListsStore } from '~/store/lists'

export function ListsEditor({ scope }: { scope: PickListScope }) {
  const { t } = useTranslation()
  const revision = useListsStore((s) => s.revision)
  const getLists = useListsStore((s) => s.getLists)
  const setLists = useListsStore((s) => s.setLists)
  const getListValuesState = useListsStore((s) => s.getListValuesState)
  const invalidatePickList = useListsStore((s) => s.invalidatePickList)
  void revision

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

  const dataclassOptions = useMemo((): EntityIoSelectOption<string>[] => {
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
        entries.map((entry) => (entry.id === id ? next : entry))
      )
    },
    [entries, scope, setLists]
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
    setLists(scope, [...entries, next])
  }, [entries, scope, setLists])

  const removeEntry = useCallback(
    (id: string) => {
      const removed = entries.find((e) => e.id === id)
      if (removed && isDataclassPickList(removed)) {
        invalidatePickList(removed.id)
      }
      setLists(
        scope,
        entries.filter((entry) => entry.id !== id)
      )
    },
    [entries, invalidatePickList, scope, setLists]
  )

  if (entries.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppEmptyPanel
          icon={List}
          title={t('lists.emptyTitle')}
          description={t('lists.emptyDescription')}
          size="md"
          className="h-full min-h-0"
          action={<EmptyPanelAction onClick={addEntry}>{t('lists.add')}</EmptyPanelAction>}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-border/50 border-b px-2 py-1.5">
        <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          {t('lists.usageHint')}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          onClick={addEntry}
        >
          <Plus className="mr-1 h-3 w-3" aria-hidden />
          {t('lists.add')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto overscroll-contain p-2">
        {entries.map((entry) => {
          const nameOk = !entry.name.trim() || isValidPickListName(entry.name)
          const valuesState = getListValuesState(entry)
          const loading = refreshingId === entry.id || valuesState.status === 'loading'
          const preview =
            valuesState.status === 'ready'
              ? `${valuesState.values.slice(0, 4).join(', ')}${
                  valuesState.values.length > 4 ? `, …(+${valuesState.values.length - 4})` : ''
                }`
              : null

          if (isHardcodedPickList(entry)) {
            return (
              <fieldset
                key={entry.id}
                aria-label={entry.name.trim() || t('lists.newEntry')}
                className="grid min-h-9 grid-cols-[minmax(6rem,0.7fr)_minmax(6.5rem,0.55fr)_minmax(10rem,1.6fr)_auto] items-start gap-1.5 rounded-md border border-border/60 bg-background/60 px-1.5 py-1 transition-colors hover:bg-muted/20"
              >
                <Input
                  ref={(el) => {
                    if (el && pendingFocusId.current === entry.id) {
                      el.focus()
                      pendingFocusId.current = null
                    }
                  }}
                  className="h-7 min-w-0 font-mono text-[10px]"
                  aria-label={t('lists.name')}
                  placeholder="statusCodes"
                  value={entry.name}
                  aria-invalid={!nameOk}
                  onChange={(event) =>
                    replaceEntry(entry.id, { ...entry, name: event.target.value })
                  }
                />
                <div className="focus-ring-wrap min-w-0">
                  <Select
                    value={entry.type}
                    onValueChange={(value) => handleTypeChange(entry.id, value as PickListKind)}
                  >
                    <SelectTrigger className="h-7 min-w-0 text-[10px]" aria-label={t('lists.type')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dataclass">{t('lists.typeDataclass')}</SelectItem>
                      <SelectItem value="hardcoded">{t('lists.typeHardcoded')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 rounded-md border border-border/50 bg-background/80">
                  <ListTagsInput
                    value={serializeListParamTags(entry.values)}
                    aria-label={t('lists.values')}
                    placeholder={t('lists.valuesPlaceholder')}
                    onChange={(raw) =>
                      replaceEntry(entry.id, {
                        ...entry,
                        values: normalizeHardcodedValues(
                          raw
                            .split(',')
                            .map((part) => part.trim())
                            .filter(Boolean)
                        ),
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-0.5 pt-0.5">
                  <Badge
                    variant="muted"
                    className="h-5 shrink-0 px-1.5 py-0 font-mono text-[9px] tabular-nums"
                  >
                    {entry.values.length}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={t('lists.remove')}
                    title={t('lists.remove')}
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
                {!nameOk ? (
                  <span
                    className="col-span-full truncate text-[10px] text-destructive"
                    role="alert"
                  >
                    {t('lists.nameInvalid')}
                  </span>
                ) : null}
              </fieldset>
            )
          }

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
              label: t('lists.attribute'),
            })
          }

          return (
            <fieldset
              key={entry.id}
              aria-label={entry.name.trim() || t('lists.newEntry')}
              className="grid min-h-9 grid-cols-[minmax(6rem,0.7fr)_minmax(6.5rem,0.55fr)_minmax(7rem,0.9fr)_minmax(7rem,0.9fr)_minmax(7rem,1.1fr)_auto] items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-1.5 py-1 transition-colors hover:bg-muted/20"
            >
              <Input
                ref={(el) => {
                  if (el && pendingFocusId.current === entry.id) {
                    el.focus()
                    pendingFocusId.current = null
                  }
                }}
                className="h-7 min-w-0 font-mono text-[10px]"
                aria-label={t('lists.name')}
                placeholder="companyKeys"
                value={entry.name}
                aria-invalid={!nameOk}
                onChange={(event) => replaceEntry(entry.id, { ...entry, name: event.target.value })}
              />
              <div className="focus-ring-wrap min-w-0">
                <Select
                  value={entry.type}
                  onValueChange={(value) => handleTypeChange(entry.id, value as PickListKind)}
                >
                  <SelectTrigger className="h-7 min-w-0 text-[10px]" aria-label={t('lists.type')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dataclass">{t('lists.typeDataclass')}</SelectItem>
                    <SelectItem value="hardcoded">{t('lists.typeHardcoded')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="focus-ring-wrap min-w-0">
                <EntityIoSelect
                  ariaLabel={t('lists.dataclass')}
                  value={entry.dataclass}
                  onValueChange={(dataclass) => void handleDataclassChange(entry.id, dataclass)}
                  options={dataclassOptions}
                  className="h-7 min-w-0 font-mono text-[10px]"
                />
              </div>
              <div className="focus-ring-wrap min-w-0">
                <EntityIoSelect
                  ariaLabel={t('lists.attribute')}
                  value={entry.attribute}
                  disabled={!entry.dataclass}
                  onValueChange={(attribute) => {
                    invalidatePickList(entry.id)
                    replaceEntry(entry.id, { ...entry, attribute })
                  }}
                  options={attributeOptions}
                  className="h-7 min-w-0 font-mono text-[10px]"
                />
              </div>
              <div
                className="flex min-w-0 items-center gap-1.5 overflow-hidden"
                title={
                  !nameOk
                    ? t('lists.nameInvalid')
                    : valuesState.status === 'error'
                      ? valuesState.message
                      : (preview ?? undefined)
                }
              >
                {!nameOk ? (
                  <>
                    <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
                    <span className="truncate text-[10px] text-destructive">
                      {t('lists.nameInvalid')}
                    </span>
                  </>
                ) : valuesState.status === 'ready' ? (
                  <>
                    <Badge
                      variant="muted"
                      className="h-5 shrink-0 px-1.5 py-0 font-mono text-[9px] tabular-nums"
                    >
                      {valuesState.values.length}
                      {valuesState.truncated ? ` · ${t('lists.truncated')}` : null}
                    </Badge>
                    <span className="truncate font-mono text-[9px] text-muted-foreground">
                      {preview}
                    </span>
                  </>
                ) : valuesState.status === 'empty' ? (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {t('lists.emptyValues')}
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
                  aria-label={t('lists.load')}
                  title={t('lists.load')}
                  disabled={
                    !entry.name.trim() || !entry.dataclass || !entry.attribute || loading || !nameOk
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
                  aria-label={t('lists.remove')}
                  title={t('lists.remove')}
                  onClick={() => removeEntry(entry.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}
