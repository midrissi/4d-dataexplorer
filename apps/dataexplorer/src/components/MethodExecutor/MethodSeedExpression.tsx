import { cn } from '@4d/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from '~/i18n'
import type { MethodExecutorSeed, MethodScope } from '~/store/method-executor-types'
import { isDataclassTab, useTabsStore } from '~/store/tabs'
import { MethodCallExpression } from './MethodCallExpression'

function isModClick(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}

export function methodScopeLabel(scope: MethodScope, t: (key: string) => string): string {
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
    // biome-ignore lint/a11y/useKeyWithClickEvents: ⌘/Ctrl+click only; keyboard users open via the row
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

/** Renders a seeded method call with ⌘/Ctrl+clickable entity / selection keys. */
export function MethodSeedExpression({ config }: { config: MethodExecutorSeed }) {
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
