import { Button, cn, useConfirm } from '@4d/ui'
import { History, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import type { MethodExecutorSeed, MethodScope } from '~/store/method-executor-types'
import type { MethodRunHistoryItem } from '~/store/method-run-history'
import { isDataclassTab, useTabsStore } from '~/store/tabs'
import { MethodCallExpression } from './MethodCallExpression'

function isModClick(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}

function scopeLabel(scope: MethodScope, t: (key: string) => string): string {
  if (scope === 'catalog') return t('methodExecutor.datastore')
  if (scope === 'dataclass') return t('methodExecutor.dataclass')
  if (scope === 'entity') return t('methodExecutor.entity')
  return t('methodExecutor.entitySelection')
}

function ModClickableKey({
  value,
  title,
  onOpen,
}: {
  value: string
  title: string
  onOpen: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [modHeld, setModHeld] = useState(false)
  const showLink = hovered && modHeld

  useEffect(() => {
    if (!hovered) return
    const syncMod = (event: KeyboardEvent) => setModHeld(event.metaKey || event.ctrlKey)
    const clearMod = () => setModHeld(false)
    window.addEventListener('keydown', syncMod)
    window.addEventListener('keyup', syncMod)
    window.addEventListener('blur', clearMod)
    return () => {
      window.removeEventListener('keydown', syncMod)
      window.removeEventListener('keyup', syncMod)
      window.removeEventListener('blur', clearMod)
    }
  }, [hovered])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: ⌘/Ctrl+click only; keyboard users open via the history row
    // biome-ignore lint/a11y/noStaticElementInteractions: mod-click affordance for opening related data
    <span
      title={showLink ? title : undefined}
      onMouseEnter={(event) => {
        setHovered(true)
        setModHeld(isModClick(event))
      }}
      onMouseMove={(event) => setModHeld(isModClick(event))}
      onMouseLeave={() => {
        setHovered(false)
        setModHeld(false)
      }}
      onClick={(event) => {
        if (!isModClick(event)) return
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      }}
      className={cn(
        'font-mono text-emerald-600 dark:text-emerald-400',
        showLink && 'cursor-pointer underline underline-offset-2'
      )}
    >
      {value}
    </span>
  )
}

function HistoryMethodExpression({ config }: { config: MethodExecutorSeed }) {
  const { t } = useTranslation()
  const openEntitySetTab = useTabsStore((state) => state.openEntitySetTab)
  const openTab = useTabsStore((state) => state.openTab)
  const setSelectedEntityId = useTabsStore((state) => state.setSelectedEntityId)

  const dataClass = config.dataClass?.trim() ?? ''
  const entityKey = config.key === undefined || config.key === '' ? '' : String(config.key)
  const selectionKey = config.entitySetId?.trim() ?? ''

  const openEntity = () => {
    if (!dataClass || !entityKey) return
    openTab(dataClass)
    const { tabs, activeTabId } = useTabsStore.getState()
    const tabId =
      activeTabId &&
      tabs.some(
        (tab) =>
          tab.id === activeTabId &&
          isDataclassTab(tab) &&
          tab.dataclassName === dataClass &&
          !tab.entitySetId
      )
        ? activeTabId
        : tabs.find(
            (tab) => isDataclassTab(tab) && tab.dataclassName === dataClass && !tab.entitySetId
          )?.id
    if (tabId) setSelectedEntityId(tabId, entityKey)
  }

  const openSelection = () => {
    if (!dataClass || !selectionKey) return
    openEntitySetTab({
      dataclassName: dataClass,
      entitySetId: selectionKey,
    })
  }

  const keyDisplay =
    config.scope === 'entity' && entityKey ? (
      <ModClickableKey
        value={entityKey}
        title={t('methodExecutor.openEntity')}
        onOpen={openEntity}
      />
    ) : config.scope === 'entitySelection' && selectionKey ? (
      <ModClickableKey
        value={selectionKey}
        title={t('methodExecutor.openEntitySelection')}
        onOpen={openSelection}
      />
    ) : undefined

  return (
    <MethodCallExpression
      scope={config.scope}
      dataClass={dataClass || undefined}
      methodName={config.methodName}
      keyDisplay={keyDisplay}
    />
  )
}

function HistoryRunRow({
  run,
  onOpen,
  onRemove,
}: {
  run: MethodRunHistoryItem
  onOpen: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const argCount = run.config.arguments?.length ?? 0

  return (
    <div className="group flex items-center gap-1 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/40">
      <button type="button" className="min-w-0 flex-1 overflow-x-auto text-left" onClick={onOpen}>
        <div className="flex flex-nowrap items-center gap-2">
          <HistoryMethodExpression config={run.config} />
          <span className="shrink-0 text-[10px] text-muted-foreground/80">
            {scopeLabel(run.config.scope, t)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{new Date(run.timestamp).toLocaleString()}</span>
          {argCount > 0 ? (
            <span>
              {argCount === 1
                ? t('methodExecutor.argumentCountOne')
                : t('methodExecutor.argumentCount', { count: argCount })}
            </span>
          ) : null}
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground opacity-50 hover:text-destructive group-hover:opacity-100"
        onClick={onRemove}
        aria-label={t('methodExecutor.removeRun')}
        title={t('methodExecutor.removeRun')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function MethodRunHistory({
  runs,
  onOpenRun,
  onRemoveRun,
  onClearRuns,
  onClose,
}: {
  runs: MethodRunHistoryItem[]
  onOpenRun: (config: MethodExecutorSeed) => void
  onRemoveRun: (id: string) => void
  onClearRuns: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()

  const handleClearAll = async () => {
    const ok = await confirm({
      title: t('methodExecutor.clearHistoryTitle'),
      description: <span>{t('methodExecutor.clearHistoryDescription')}</span>,
      confirmText: t('methodExecutor.clearAll'),
      cancelText: t('methodExecutor.cancel'),
      variant: 'destructive',
    })
    if (!ok) return
    onClearRuns()
    onClose()
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <ConfirmDialog />
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">{t('methodExecutor.lastRuns')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => void handleClearAll()}
          disabled={runs.length === 0}
        >
          {t('methodExecutor.clearAll')}
        </Button>
      </div>
      {runs.length === 0 ? (
        <EmptyPanel
          icon={History}
          badgeTone="muted"
          title={t('methodExecutor.noRunsTitle')}
          description={t('methodExecutor.noRunsDescription')}
          ghost="rows"
          bordered
          size="sm"
        />
      ) : (
        <div className="max-h-64 overflow-y-auto overscroll-contain rounded-md bg-muted/25 p-0.5">
          {runs.map((run) => (
            <HistoryRunRow
              key={run.id}
              run={run}
              onOpen={() => onOpenRun(run.config)}
              onRemove={() => onRemoveRun(run.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
