import { Button, cn, Input } from '@4d/ui'
import {
  Boxes,
  Code2,
  Database,
  FileText,
  Hexagon,
  type LucideIcon,
  Rows3,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { getDataclassColorClasses } from '~/components/DataclassCustomizeModal'
import { EmptyPanel } from '~/components/EmptyPanel'
import { OpenInNewTabHint } from '~/components/OpenInNewTabHint'
import { useTranslation } from '~/i18n'
import { isModClick, isModShiftClick } from '~/lib/mod-click'
import { isMobileShell } from '~/lib/platform'
import type { MethodScope } from '~/store/method-executor-types'
import { useDataclassCustomizations } from '~/store/settings'
import { EntitySelectionKeyInput } from './EntitySelectionKeyInput'
import { MethodCallExpression } from './MethodCallExpression'
import { denseParamsText } from './method-list-display'
import { SearchableDataclassSelect } from './SearchableDataclassSelect'
import { SearchableMethodSelect } from './SearchableMethodSelect'
import type { MethodCatalogItem } from './useMethodCatalog'

const SCOPES: MethodScope[] = ['catalog', 'singleton', 'dataclass', 'entity', 'entitySelection']

const SCOPE_ICONS: Record<MethodScope, LucideIcon> = {
  catalog: Database,
  singleton: Hexagon,
  dataclass: Boxes,
  entity: FileText,
  entitySelection: Rows3,
}

function scopeLabel(scope: MethodScope, t: (key: string) => string): string {
  if (scope === 'catalog') return t('methodExecutor.datastore')
  if (scope === 'singleton') return t('methodExecutor.singleton')
  if (scope === 'dataclass') return t('methodExecutor.dataclass')
  if (scope === 'entity') return t('methodExecutor.entity')
  return t('methodExecutor.entitySelection')
}

function catalogTargetName(method: MethodCatalogItem): string {
  return method.singletonName ?? method.dataClass ?? 'datastore'
}

export function MethodSelector({
  scope,
  methodName,
  dataClass,
  singletonName,
  keyValue,
  entitySetId,
  methods,
  dataClasses,
  singletons,
  catalogLoading,
  catalogError,
  onScopeChange,
  onChooseMethod,
  onClearMethod,
  onDataClassChange,
  onSingletonNameChange,
  onKeyChange,
  onEntitySetIdChange,
}: {
  scope: MethodScope
  methodName: string
  dataClass: string
  singletonName: string
  keyValue: string
  entitySetId: string
  methods: MethodCatalogItem[]
  dataClasses: string[]
  singletons: string[]
  catalogLoading: boolean
  catalogError: string | null
  onScopeChange: (scope: MethodScope) => void
  onChooseMethod: (
    item: MethodCatalogItem,
    options?: { forceNew?: boolean; openInHttpClient?: boolean }
  ) => void
  onClearMethod: () => void
  onDataClassChange: (value: string) => void
  onSingletonNameChange: (value: string) => void
  onKeyChange: (value: string) => void
  onEntitySetIdChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const customizations = useDataclassCustomizations()
  const [search, setSearch] = useState('')
  const [catalogFilter, setCatalogFilter] = useState('')
  const searchId = useId()
  const deferredQuery = search.trim().toLowerCase()
  const showPicker = !methodName
  const needsDataclass = scope === 'dataclass' || scope === 'entity' || scope === 'entitySelection'
  const needsSingleton = scope === 'singleton'
  const needsTarget = needsDataclass || needsSingleton
  const selectedTarget = needsSingleton ? singletonName : dataClass
  const targetOptions = needsSingleton ? singletons : dataClasses
  const selectionKey = scope === 'entity' ? keyValue : entitySetId
  const selectionKeyWidth = Math.max(selectionKey.length, 1)

  useEffect(() => {
    setCatalogFilter('')
    setSearch('')
  }, [])

  const filteredMethods = useMemo(() => {
    return methods.filter((method) => {
      if (method.scope !== scope) return false
      if (needsSingleton && catalogFilter && method.singletonName !== catalogFilter) return false
      if (needsDataclass && catalogFilter && method.dataClass !== catalogFilter) return false
      if (!deferredQuery) return true
      return `${catalogTargetName(method)} ${method.methodName} ${method.paramsText ?? ''}`
        .toLowerCase()
        .includes(deferredQuery)
    })
  }, [catalogFilter, deferredQuery, methods, needsDataclass, needsSingleton, scope])

  const switchableMethods = useMemo(() => {
    return methods.filter((method) => {
      if (method.scope !== scope) return false
      if (needsSingleton && singletonName && method.singletonName !== singletonName) return false
      if (needsDataclass && dataClass && method.dataClass !== dataClass) return false
      return true
    })
  }, [dataClass, methods, needsDataclass, needsSingleton, scope, singletonName])

  const selectedKeySlot =
    scope === 'entity' ? (
      <input
        value={selectionKey}
        onChange={(event) => onKeyChange(event.target.value)}
        aria-label={t('methodExecutor.entityKey')}
        size={selectionKeyWidth}
        style={{ width: `${selectionKeyWidth}ch`, fieldSizing: 'content' }}
        className="m-0 inline-block min-w-[1ch] appearance-none border-0 bg-transparent p-0 align-middle font-mono text-emerald-600 text-xs leading-none outline-none dark:text-emerald-400"
      />
    ) : scope === 'entitySelection' ? (
      <EntitySelectionKeyInput
        value={selectionKey}
        label={t('methodExecutor.entitySelectionKey')}
        dataClass={dataClass}
        onChange={onEntitySetIdChange}
      />
    ) : undefined

  const targetFilterLabel = needsSingleton
    ? t('methodExecutor.singleton')
    : t('methodExecutor.dataclass')
  const allTargetsLabel = needsSingleton
    ? t('methodExecutor.allSingletons')
    : t('methodExecutor.allDataclasses')

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="space-y-2 rounded-lg bg-muted/25 p-1.5">
        <div
          role="tablist"
          aria-label={t('methodExecutor.scope')}
          className={cn(
            'scrollbar-none flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded border bg-muted/40 p-0.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            mobile ? 'h-9' : 'h-6'
          )}
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
                  'inline-flex shrink-0 items-center gap-1 rounded-sm font-medium transition-colors',
                  mobile ? 'h-7.5 px-2.5 text-xs' : 'h-5 px-1.5 text-[10px]',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon
                  className={cn('shrink-0 opacity-70', mobile ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')}
                  aria-hidden
                />
                {scopeLabel(item, t)}
              </button>
            )
          })}
        </div>

        {showPicker ? (
          <>
            <div
              className={cn(
                'flex items-center gap-x-2 gap-y-1 px-0.5',
                mobile ? 'flex-col items-stretch' : 'flex-wrap'
              )}
            >
              {needsTarget ? (
                <div
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 text-xs',
                    mobile && 'justify-between'
                  )}
                >
                  <span className="shrink-0 text-muted-foreground">
                    {t('methodExecutor.fromDataclass')}
                  </span>
                  <SearchableDataclassSelect
                    value={catalogFilter}
                    dataClasses={targetOptions}
                    argumentName={targetFilterLabel}
                    emptyOptionLabel={allTargetsLabel}
                    onChange={setCatalogFilter}
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
                  className={cn(
                    'border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0',
                    // Keep ≤16px for iOS zoom safety via maximum-scale=1; match surrounding UI.
                    mobile ? 'h-9 text-sm' : 'h-8 text-xs'
                  )}
                />
              </div>
            </div>
            <div
              className={cn(
                'overflow-hidden overflow-y-auto overscroll-contain rounded-md border bg-background',
                mobile ? 'max-h-64' : 'max-h-52'
              )}
            >
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
                  className="min-h-0 py-4"
                />
              ) : (
                filteredMethods.map((method) => {
                  const customization = method.dataClass
                    ? customizations[method.dataClass]
                    : undefined
                  const colorClasses = getDataclassColorClasses(customization)
                  const signature = denseParamsText(method.paramsText)
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={(event) => {
                        onChooseMethod(method, {
                          forceNew: isModClick(event) && !event.shiftKey,
                          openInHttpClient: isModShiftClick(event),
                        })
                        setSearch('')
                      }}
                      style={colorClasses.style}
                      className={cn(
                        'group/row flex w-full min-w-0 items-center gap-1.5 border-border/60 border-b text-left last:border-b-0',
                        'transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        mobile ? 'min-h-11 px-2 py-1.5' : 'h-7 px-2'
                      )}
                    >
                      <span className="min-w-0 flex-1 overflow-x-auto">
                        <MethodCallExpression
                          scope={method.scope}
                          dataClass={method.dataClass}
                          singletonName={method.singletonName}
                          methodName={method.methodName}
                        />
                      </span>
                      {signature ? (
                        <span
                          className="max-w-[50%] shrink-0 truncate font-mono text-[10px] text-muted-foreground/75"
                          title={method.paramsText}
                        >
                          {signature}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full opacity-70',
                            method.scope === 'singleton' ? 'bg-fuchsia-500' : colorClasses.bg
                          )}
                          aria-hidden
                        />
                      )}
                    </button>
                  )
                })
              )}
            </div>
            <OpenInNewTabHint
              className="px-0.5 pt-1"
              labelKey="common.openInBackgroundModClickHint"
            />
          </>
        ) : (
          <div
            className={cn(
              'group flex items-center gap-1.5 overflow-hidden rounded-md border bg-background px-2',
              'hover:bg-muted/40',
              mobile ? 'min-h-11 py-1' : 'h-7'
            )}
          >
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto">
              <MethodCallExpression
                scope={scope}
                dataClass={dataClass || undefined}
                singletonName={singletonName || undefined}
                methodName={methodName}
                dataClassSlot={
                  needsTarget ? (
                    <SearchableDataclassSelect
                      value={selectedTarget}
                      dataClasses={targetOptions}
                      argumentName={methodName}
                      onChange={needsSingleton ? onSingletonNameChange : onDataClassChange}
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
              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                {scopeLabel(scope, t)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground opacity-60 hover:text-foreground group-hover:opacity-100"
              onClick={onClearMethod}
              aria-label={t('methodExecutor.chooseMethod')}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {catalogError ? <p className="text-destructive text-sm">{catalogError}</p> : null}
    </div>
  )
}
