import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { eventBus } from '~/lib/eventBus'
import { useShortcutController } from '~/providers/ShortcutController'
import { useDataExplorerStore } from '~/store'
import { useActiveDataclassTab, useTabsStore } from '~/store/tabs'

interface KeyboardShortcutsContextValue {
  focusedEntityIndex: number
  setFocusedEntityIndex: (index: number) => void
  showShortcuts: () => void
  hideShortcuts: () => void
  isShortcutsModalOpen: boolean
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | undefined>(undefined)

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [focusedEntityIndex, setFocusedEntityIndex] = useState(-1)
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const { registerShortcutHandler } = useShortcutController()

  const entities = useDataExplorerStore((s) => s.entities)
  const selectEntity = useDataExplorerStore((s) => s.selectEntity)
  const selectedDataclass = useDataExplorerStore((s) => s.selectedDataclass)
  const selectedEntityId = useDataExplorerStore((s) => s.selectedEntityId)

  const activeTab = useActiveDataclassTab()
  const setSelectedEntityId = useTabsStore((s) => s.setSelectedEntityId)

  const showShortcuts = useCallback(() => setIsShortcutsModalOpen(true), [])
  const hideShortcuts = useCallback(() => setIsShortcutsModalOpen(false), [])

  // Escape: close modal or unselect entity (not a shortcut from settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      if (isShortcutsModalOpen) {
        hideShortcuts()
        return
      }
      if (selectedDataclass) {
        selectEntity(null)
        setFocusedEntityIndex(-1)
        if (activeTab) setSelectedEntityId(activeTab.id, null)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [
    isShortcutsModalOpen,
    hideShortcuts,
    selectedDataclass,
    selectEntity,
    activeTab,
    setSelectedEntityId,
  ])

  // Register entity/shortcut handlers with ShortcutController (supports single keys and chords).
  // Entity prev/next are delegated to EntityViewer via the event bus so navigation starts from
  // the currently selected row (not a stale focusedEntityIndex that may have been reset to -1).
  useEffect(() => {
    const unreg = [
      registerShortcutHandler('show-shortcuts', showShortcuts),
      registerShortcutHandler('nav-prev', () => eventBus.emit('nav-prev')),
      registerShortcutHandler('nav-next', () => eventBus.emit('nav-next')),
      registerShortcutHandler('refresh', () => eventBus.emit('refresh-view')),
      registerShortcutHandler('new-entity', () => eventBus.emit('new-entity')),
      registerShortcutHandler('edit-entity', () => eventBus.emit('edit-entity')),
      registerShortcutHandler('save-entity', () => eventBus.emit('save-entity')),
      registerShortcutHandler('duplicate-entity', () => eventBus.emit('duplicate-entity')),
      registerShortcutHandler('delete-entity', () => eventBus.emit('delete-entity')),
      registerShortcutHandler('cancel-edit', () => eventBus.emit('cancel-edit')),
      registerShortcutHandler('go-to-entity', () => eventBus.emit('go-to-entity')),
      registerShortcutHandler('page-first', () => eventBus.emit('page-first')),
      registerShortcutHandler('page-prev', () => eventBus.emit('page-prev')),
      registerShortcutHandler('page-next', () => eventBus.emit('page-next')),
      registerShortcutHandler('page-last', () => eventBus.emit('page-last')),
    ]
    return () =>
      unreg.forEach((u) => {
        u()
      })
  }, [registerShortcutHandler, showShortcuts])

  // Keep focused index aligned with the selected entity when the dataclass or
  // entity page changes (e.g. after fetch). Prefer selectedEntityId over a
  // hard reset to -1 so arrow navigation continues from the current selection.
  const [resetKey, setResetKey] = useState<{
    dataclass: string | null
    entities: unknown
  }>({
    dataclass: selectedDataclass,
    entities,
  })
  if (resetKey.dataclass !== selectedDataclass || resetKey.entities !== entities) {
    setResetKey({ dataclass: selectedDataclass, entities })
    const idx =
      selectedEntityId != null ? entities.findIndex((entity) => entity.id === selectedEntityId) : -1
    setFocusedEntityIndex(idx)
  }

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        focusedEntityIndex,
        setFocusedEntityIndex,
        showShortcuts,
        hideShortcuts,
        isShortcutsModalOpen,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext)
  if (context === undefined) {
    throw new Error('useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider')
  }
  return context
}
