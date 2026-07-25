import { Button, cn, Input } from '@4d/ui'
import { Boxes, Code2, Database, FileText, type LucideIcon, Rows3, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { getDataclassColorClasses } from '~/components/DataclassCustomizeModal'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import type { MethodScope } from '~/store/method-executor-types'
import { useDataclassCustomizations } from '~/store/settings'
import { EntitySelectionKeyInput } from './EntitySelectionKeyInput'
import { MethodCallExpression } from './MethodCallExpression'
import { SearchableDataclassSelect } from './SearchableDataclassSelect'
import { SearchableMethodSelect } from './SearchableMethodSelect'
import type { MethodCatalogItem } from './useMethodCatalog'

const SCOPES: MethodScope[] = ['catalog', 'dataclass', 'entity', 'entitySelection']

const SCOPE_ICONS: Record<MethodScope, LucideIcon> = {
  catalog: Database,
  dataclass: Boxes,
  entity: FileText,
  entitySelection: Rows3,
}

function scopeLabel(scope: MethodScope, t: (key: string) => string): string {
  if (scope === 'catalog') return t('methodExecutor.datastore')
  if (scope === 'dataclass') return t('methodExecutor.dataclass')
  if (scope === 'entity') return t('methodExecutor.entity')
  return t('methodExecutor.entitySelection')
}

export function MethodSelector({
  scope,
  methodName,
  dataClass,
  keyValue,
  entitySetId,
  methods,
  dataClasses,
  catalogLoading,
  catalogError,
  onScopeChange,
  onChooseMethod,
  onClearMethod,
  onDataClassChange,
  onKeyChange,
  onEntitySetIdChange,
}: {
  scope: MethodScope
  methodName: string
  dataClass: string
  keyValue: string
  entitySetId: string
  methods: MethodCatalogItem[]
  dataClasses: string[]
  catalogLoading: boolean
  catalogError: string | null
  onScopeChange: (scope: MethodScope) => void
  onChooseMethod: (item: MethodCatalogItem) => void
  onClearMethod: () => void
  onDataClassChange: (value: string) => void
  onKeyChange: (value: string) => void
  onEntitySetIdChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const customizations = useDataclassCustomizations()
  const [search, setSearch] = useState('')
  const [catalogDataClass, setCatalogDataClass] = useState('')
  const searchId = useId()
  const deferredQuery = search.trim().toLowerCase()
  const showPicker = !methodName
  const needsTarget = scope !== 'catalog'
  const selectionKey = scope === 'entity' ? keyValue : entitySetId
  const selectionKeyWidth = Math.max(selectionKey.length, 1)

  useEffect(() => {
    setCatalogDataClass('')
    setSearch('')
  }, [])

  const filteredMethods = useMemo(() => {
    return methods.filter((method) => {
      if (method.scope !== scope) return false
      if (needsTarget && catalogDataClass && method.dataClass !== catalogDataClass) return false
      if (!deferredQuery) return true
      return `${method.dataClass ?? 'datastore'} ${method.methodName} ${method.paramsText ?? ''}`
        .toLowerCase()
        .includes(deferredQuery)
    })
  }, [catalogDataClass, deferredQuery, methods, needsTarget, scope])

  const switchableMethods = useMemo(() => {
    return methods.filter((method) => {
      if (method.scope !== scope) return false
      if (needsTarget && dataClass && method.dataClass !== dataClass) return false
      return true
    })
  }, [dataClass, methods, needsTarget, scope])

  const selectedKeySlot =
    scope === 'entity' ? (
      <input
        value={selectionKey}
        onChange={(event) => onKeyChange(event.target.value)}
        aria-label={t('methodExecutor.entityKey')}
        size={selectionKeyWidth}
        style={{ width: `${selectionKeyWidth}ch`, fieldSizing: 'content' }}
        className="m-0 inline-block min-w-[1ch] appearance-none border-0 bg-transparent p-0 align-middle font-mono text-emerald-600 text-xs leading-5 outline-none dark:text-emerald-400"
      />
    ) : scope === 'entitySelection' ? (
      <EntitySelectionKeyInput
        value={selectionKey}
        label={t('methodExecutor.entitySelectionKey')}
        dataClass={dataClass}
        onChange={onEntitySetIdChange}
      />
    ) : undefined

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="space-y-2 rounded-lg bg-muted/25 p-1.5">
        <div
          role="tablist"
          aria-label={t('methodExecutor.scope')}
          className="scrollbar-none flex h-6 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded border bg-muted/40 p-0.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {SCOPES.map((item) => {
            const active = item === scope
            const Icon = SCOPE_ICONS[item]
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onScopeChange(item)}
                className={cn(
                  'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 font-medium text-[10px] transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
                {scopeLabel(item, t)}
              </button>
            )
          })}
        </div>

        {showPicker ? (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
              {needsTarget ? (
                <div className="flex min-w-0 items-center gap-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {t('methodExecutor.fromDataclass')}
                  </span>
                  <SearchableDataclassSelect
                    value={catalogDataClass}
                    dataClasses={dataClasses}
                    argumentName={t('methodExecutor.dataclass')}
                    emptyOptionLabel={t('methodExecutor.allDataclasses')}
                    onChange={setCatalogDataClass}
                  />
                </div>
              ) : null}
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={searchId}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('methodExecutor.searchPlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8 border-0 bg-transparent pl-8 text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto overscroll-contain">
              {catalogLoading ? (
                <p className="px-2 py-4 text-center text-muted-foreground text-xs">
                  {t('methodExecutor.loadingMethods')}
                </p>
              ) : filteredMethods.length === 0 ? (
                <EmptyPanel
                  icon={Code2}
                  badgeIcon={Search}
                  badgeTone="amber"
                  title={t('methodExecutor.noMethodsTitle')}
                  description={t('methodExecutor.noMethodsDescription')}
                  ghost="none"
                  size="sm"
                />
              ) : (
                filteredMethods.map((method) => {
                  const customization = method.dataClass
                    ? customizations[method.dataClass]
                    : undefined
                  const colorClasses = getDataclassColorClasses(customization)
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        onChooseMethod(method)
                        setSearch('')
                      }}
                      style={colorClasses.style}
                      className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <MethodCallExpression
                        scope={method.scope}
                        dataClass={method.dataClass}
                        methodName={method.methodName}
                      />
                      {method.paramsText ? (
                        <span className="ml-auto hidden max-w-[40%] truncate font-mono text-[10px] text-muted-foreground/70 sm:inline">
                          {method.paramsText}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'ml-auto h-1.5 w-1.5 shrink-0 rounded-full',
                            colorClasses.bg
                          )}
                        />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </>
        ) : (
          <div className="group flex items-start gap-1 rounded-md px-1 py-1.5 hover:bg-muted/40">
            <div className="min-w-0 flex-1 space-y-1 pt-0.5">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                <MethodCallExpression
                  scope={scope}
                  dataClass={dataClass || undefined}
                  methodName={methodName}
                  dataClassSlot={
                    needsTarget ? (
                      <SearchableDataclassSelect
                        value={dataClass}
                        dataClasses={dataClasses}
                        argumentName={methodName}
                        onChange={onDataClassChange}
                      />
                    ) : undefined
                  }
                  methodSlot={
                    <SearchableMethodSelect
                      value={methodName}
                      methods={switchableMethods}
                      loading={catalogLoading}
                      onChange={onChooseMethod}
                    />
                  }
                  keySlot={selectedKeySlot}
                />
                <span className="rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground/80">
                  {scopeLabel(scope, t)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground opacity-60 hover:text-foreground group-hover:opacity-100"
              onClick={onClearMethod}
              aria-label={t('methodExecutor.chooseMethod')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {catalogError ? <p className="text-destructive text-sm">{catalogError}</p> : null}
    </div>
  )
}
