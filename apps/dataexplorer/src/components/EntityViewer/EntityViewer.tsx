import {
  Button,
  ClickToCopy,
  CodeEditor,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
  useToast,
} from '@4d/ui'
import {
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Copy,
  Edit2,
  FileJson,
  FileText,
  Loader2,
  MousePointerClick,
  Network,
  RefreshCw,
  Save,
  Trash2,
  TreePine,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { EntityForm, type EntityFormHandle } from '~/components/EntityForm'
import { EntityDetailSkeleton } from '~/components/EntityLoadingSkeleton'
import { ErrorList } from '~/components/ErrorList'
import { MethodListPopover } from '~/components/MethodExecutor/MethodListPopover'
import { SwipeNavigate } from '~/components/SwipeNavigate'
import { useEditorLabels, useTranslation } from '~/i18n'
import { api, formatThrownError } from '~/lib/api'
import { isInternalAttribute } from '~/lib/entity-viewer/attributes'
import { sanitizeForEditing } from '~/lib/entitySanitizer'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import { useKeyboardShortcutsContext } from '~/providers/KeyboardShortcutsProvider'
import { type Entity, useDataExplorerStore } from '~/store'
import {
  type EditMode,
  formatShortcut,
  useCodeEditorPrefs,
  useDefaultEditMode,
  useDefaultEntityViewMode,
  useReadonlyMode,
  useShortcut,
  useUpdateCodeEditorPrefs,
} from '~/store/settings'
import { isDataclassTab, useTabsStore } from '~/store/tabs'
import { EntityStats } from './EntityStats'
import { FormView } from './FormView'
import { MetadataPanel } from './MetadataPanel'
import { TreeNode } from './TreeNode'
import { useHighlightInGraph } from './use-highlight-in-graph'

// Stable empty array so per-tab reads don't trigger spurious re-renders
const EMPTY_ENTITIES: Entity[] = []

export type EntityViewerProps =
  | { tabId: string; entity?: undefined; dataclassName?: undefined }
  | {
      tabId?: undefined
      entity: Record<string, unknown>
      dataclassName?: string | null
    }

export function EntityViewer(props: EntityViewerProps) {
  const { t } = useTranslation()
  const editorLabels = useEditorLabels()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const { updateEntity, deleteEntity, selectEntity, fetchEntities } = useDataExplorerStore()
  const isStandalone = props.entity !== undefined
  const tabId = props.tabId ?? ''
  const sourceEntity = props.entity ?? null
  const [standaloneEntity, setStandaloneEntity] = useState<Record<string, unknown> | null>(
    sourceEntity
  )

  useEffect(() => {
    if (isStandalone) setStandaloneEntity(sourceEntity)
  }, [isStandalone, sourceEntity])

  // This viewer renders a specific tab (kept mounted across tab switches), so it
  // reads its own tab and cached entity slice rather than the active-tab mirror.
  const activeDataclassTab = useTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab && isDataclassTab(tab) ? tab : null
  })
  const selectedDataclass = isStandalone
    ? (props.dataclassName ??
      (typeof standaloneEntity?.__DATACLASS === 'string'
        ? standaloneEntity.__DATACLASS
        : typeof standaloneEntity?.__entityModel === 'string'
          ? standaloneEntity.__entityModel
          : null))
    : (activeDataclassTab?.dataclassName ?? null)
  const view = useDataExplorerStore((s) => s.tabData[tabId])
  const storeSelectedEntity = view?.selectedEntity ?? null
  const storeSelectedEntityId = view?.selectedEntityId ?? null
  const selectedEntityId = isStandalone
    ? String(standaloneEntity?.__KEY ?? standaloneEntity?.id ?? '') || null
    : (storeSelectedEntityId ?? activeDataclassTab?.selectedEntityId ?? null)
  const entities = isStandalone ? EMPTY_ENTITIES : (view?.entities ?? EMPTY_ENTITIES)
  const pagination = isStandalone ? null : (view?.pagination ?? null)
  const entitiesLoading = isStandalone ? false : Boolean(view?.entitiesLoading)

  // When a field selection ($attributes/select) is active, the entities loaded
  // in the list are partial (only the selected columns). The details view must
  // always show ALL attributes, so fetch the full entity by key when a selection
  // is active and use it in place of the partial list entity. A selection can
  // come from the FieldManager (per-tab fieldConfig) or the advanced query
  // builder (queryOptions.select).
  const querySelect = activeDataclassTab?.queryOptions.select
  const selectActive =
    !isStandalone &&
    ((activeDataclassTab?.fieldConfig?.table.length ?? 0) > 0 ||
      (activeDataclassTab?.fieldConfig?.cards.length ?? 0) > 0 ||
      (querySelect?.trim().length ?? 0) > 0)
  const [fullEntity, setFullEntity] = useState<Entity | null>(null)
  // True while the full entity for the newly selected id is being fetched. While
  // loading we keep displaying the previously loaded full entity (instead of an
  // empty/partial panel) to avoid flickering, and disable the panel controls.
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const selectedEntity = isStandalone
    ? standaloneEntity
    : fullEntity && fullEntity.id === selectedEntityId
      ? fullEntity
      : isLoadingDetails && fullEntity
        ? fullEntity
        : storeSelectedEntity

  // setSelectedEntityId for syncing with EntityList
  const setSelectedEntityId = useTabsStore((s) => s.setSelectedEntityId)

  // Get focused entity index for syncing with EntityList
  const { setFocusedEntityIndex } = useKeyboardShortcutsContext()

  // Readonly mode
  const settingsReadonlyMode = useReadonlyMode()
  const readonlyMode = isStandalone || settingsReadonlyMode

  // Get default entity view mode from settings
  const defaultEntityViewMode = useDefaultEntityViewMode()

  // Get default edit mode from settings
  const defaultEditMode = useDefaultEditMode()

  const highlightInGraph = useHighlightInGraph()

  // Mobile: prefer the form tab (friendlier than raw tree/hex nodes on a small
  // screen) and hide the tree tab entirely, regardless of the desktop default.
  const mobile = isMobileShell()

  const pageFirstShortcut = useShortcut('page-first')
  const navPrevShortcut = useShortcut('nav-prev')
  const navNextShortcut = useShortcut('nav-next')
  const pageLastShortcut = useShortcut('page-last')
  const editEntityShortcut = useShortcut('edit-entity')
  const saveEntityShortcut = useShortcut('save-entity')
  const cancelEditShortcut = useShortcut('cancel-edit')
  const deleteEntityShortcut = useShortcut('delete-entity')
  const openStructureShortcut = useShortcut('open-structure')

  const resolveDefaultTab = useCallback((): 'tree' | 'json' | 'form' => {
    if (mobile) return defaultEntityViewMode === 'json' ? 'json' : 'form'
    return defaultEntityViewMode === 'tree'
      ? 'tree'
      : defaultEntityViewMode === 'json'
        ? 'json'
        : 'form'
  }, [mobile, defaultEntityViewMode])
  const [activeTab, setActiveTab] = useState<'tree' | 'json' | 'form'>(resolveDefaultTab)
  const [previousTab, setPreviousTab] = useState<'tree' | 'json' | 'form'>(resolveDefaultTab)
  const activeTabRef = useRef(activeTab)

  // Sync with settings when default entity view mode changes
  useEffect(() => {
    const tab = resolveDefaultTab()
    setActiveTab(tab)
    setPreviousTab(tab)
    activeTabRef.current = tab
  }, [resolveDefaultTab])

  // Keep ref in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  const [isEditing, setIsEditing] = useState(false)
  const [editedEntity, setEditedEntity] = useState('')
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  // Update editor content when selected entity changes
  useEffect(() => {
    if (selectedEntity) {
      setEditedEntity(JSON.stringify(selectedEntity, null, 2))
      setFormData(selectedEntity)
      setIsEditing(false)
      setExpandAll(undefined) // Reset expand state for new entity
    }
  }, [selectedEntity])

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessAt, setSaveSuccessAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)

  // Hydrate entity details when we have a selected id but no in-memory entity
  // (e.g. after reload: tab persists selectedEntityId, entity payload does not),
  // or when a field selection means the list row is only a partial projection.
  useEffect(() => {
    if (isStandalone || !selectedDataclass || !selectedEntityId) {
      setFullEntity(null)
      setIsLoadingDetails(false)
      return
    }

    const hasMatchingStoreEntity = storeSelectedEntity?.id === selectedEntityId
    if (hasMatchingStoreEntity && !selectActive) {
      setFullEntity(null)
      setIsLoadingDetails(false)
      return
    }

    let cancelled = false
    setIsLoadingDetails(true)
    api
      .getEntity(selectedDataclass, selectedEntityId)
      .then((res) => {
        if (!cancelled) setFullEntity(res.entity as Entity)
      })
      .catch(() => {
        if (!cancelled) setFullEntity(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false)
      })
    return () => {
      cancelled = true
    }
  }, [isStandalone, selectActive, selectedDataclass, selectedEntityId, storeSelectedEntity?.id])

  useEffect(() => {
    if (saveSuccessAt === null) return
    const t = setTimeout(() => setSaveSuccessAt(null), 2000)
    return () => clearTimeout(t)
  }, [saveSuccessAt])

  useEffect(() => {
    if (!isEditing) setError(null)
  }, [isEditing])

  const { confirm, ConfirmDialog } = useConfirm()
  const toast = useToast()
  const formRef = useRef<EntityFormHandle>(null)

  // Save from EntityForm (form tab when editing)
  const handleSaveFromForm = useCallback(
    async (data: Record<string, unknown>) => {
      if (isStandalone || !selectedEntityId || !selectedDataclass) return

      setError(null)
      try {
        let dataToSave: Record<string, unknown> = { ...data }
        if (selectedEntity && '__STAMP' in selectedEntity) {
          dataToSave.__STAMP = selectedEntity.__STAMP
        }
        const sanitized = await sanitizeForEditing(dataToSave, selectedDataclass)
        dataToSave = sanitized
        if (selectedEntity && '__STAMP' in selectedEntity) {
          dataToSave.__STAMP = selectedEntity.__STAMP
        }
        try {
          const schema = await api.getDataclassSchema(selectedDataclass)
          for (const attr of schema.attributes) {
            if (attr.type !== 'blob' && attr.type !== 'image') continue
            const value = data[attr.name]
            if (
              value &&
              typeof value === 'object' &&
              'ID' in value &&
              typeof (value as { ID: string }).ID === 'string'
            ) {
              dataToSave[attr.name] = value
            }
          }
        } catch {
          // If schema fetch fails, skip preserving image/blob fields
        }
        await updateEntity(selectedEntityId, dataToSave)
        setIsEditing(false)
        setFullEntity(null)
        setSaveSuccessAt(Date.now())
      } catch (err) {
        setError(err instanceof Error ? err.message : t('entity.failedToSaveEntity'))
        throw err
      }
    },
    [isStandalone, selectedEntityId, selectedDataclass, selectedEntity, updateEntity, t]
  )

  // Save from JSON tab (CodeEditor)
  const handleSave = useCallback(async () => {
    if (isStandalone || !selectedEntityId) return
    if (activeTab !== 'json') return

    setError(null)
    setIsSaving(true)
    try {
      if (!editedEntity) return
      const dataToSave = JSON.parse(editedEntity) as Record<string, unknown>
      if (selectedEntity && '__STAMP' in selectedEntity && !('__STAMP' in dataToSave)) {
        dataToSave.__STAMP = selectedEntity.__STAMP
      }
      await updateEntity(selectedEntityId, dataToSave)
      setIsEditing(false)
      setFullEntity(null)
      setSaveSuccessAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('entity.failedToSaveEntity'))
    } finally {
      setIsSaving(false)
    }
  }, [isStandalone, selectedEntityId, activeTab, editedEntity, selectedEntity, updateEntity, t])

  const handleDelete = useCallback(async () => {
    if (isStandalone || !selectedEntityId || !selectedDataclass) return

    const confirmed = await confirm({
      title: t('entity.deleteEntityTitle'),
      description: (
        <div className="space-y-4">
          <p>{t('entity.deleteConfirmDescription')}</p>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-muted-foreground text-sm">
              <strong>{t('entity.keyLabel')}</strong> {selectedEntityId}
            </p>
          </div>
        </div>
      ),
      confirmText: t('entity.delete'),
      variant: 'destructive',
      icon: <Trash2 className="h-5 w-5 text-destructive" />,
    })

    if (!confirmed) return

    try {
      await deleteEntity(selectedEntityId)
    } catch (err) {
      const reason = formatThrownError(err, t('entity.failedToDeleteEntity'))
      toast.error(
        t('entity.deleteEntityErrorTitle', {
          dataclass: selectedDataclass ?? '',
          key: selectedEntityId,
        }),
        { description: t('entity.actionErrorReason', { reason }) }
      )
    }
  }, [isStandalone, selectedEntityId, selectedDataclass, deleteEntity, confirm, t, toast])

  // Handle entering edit mode with optional mode override
  const handleEnterEditMode = useCallback(
    async (editMode?: EditMode) => {
      if (isStandalone || !selectedEntity || !selectedDataclass) return

      // Store current tab before switching
      setPreviousTab(activeTabRef.current)

      // Use provided mode, or default from settings (mobile always prefers form)
      const targetMode = editMode ?? (mobile ? 'form' : defaultEditMode)
      setActiveTab(targetMode)
      setIsEditing(true)

      // Filter entity before setting it in the editor
      const filtered = await sanitizeForEditing(selectedEntity, selectedDataclass)
      setEditedEntity(JSON.stringify(filtered, null, 2))
      setFormData(filtered)
    },
    [isStandalone, selectedEntity, selectedDataclass, defaultEditMode, mobile]
  )

  // Handle form field changes (used by FormView in read-only form tab)
  const handleFormFieldChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setIsEditing(true)
  }, [])

  // Reload the currently selected entity from the server, refreshing all of its
  // attributes (including deferred BLOBs/relations, which are keyed off the
  // freshly fetched value). No-op while editing to avoid discarding local edits.
  const [isReloadingEntity, setIsReloadingEntity] = useState(false)
  const handleReloadEntity = useCallback(async () => {
    if (!selectedDataclass || !selectedEntityId || isEditing) return
    setIsReloadingEntity(true)
    setError(null)
    try {
      const res = await api.getEntity(selectedDataclass, selectedEntityId)
      const entity = res.entity as Entity
      if (isStandalone) {
        setStandaloneEntity(entity)
        return
      }
      // Keep the full-attribute details view in sync when a field selection is
      // active; otherwise the shared/store selection drives the display.
      if (selectActive) {
        setFullEntity(entity)
      }
      selectEntity(entity)
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, entity.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('entity.failedToReloadEntity'))
    } finally {
      setIsReloadingEntity(false)
    }
  }, [
    selectedDataclass,
    selectedEntityId,
    isEditing,
    isStandalone,
    selectActive,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    t,
  ])

  // Listen for keyboard shortcut events
  useEffect(() => {
    if (isStandalone) return
    const subscriptions = [
      eventBus.on('edit-entity', () => {
        if (selectedEntityId && !isEditing) {
          handleEnterEditMode()
        }
      }),
      eventBus.on('save-entity', () => {
        if (isEditing && !isSaving) {
          if (activeTab === 'form') {
            formRef.current?.submit()
          } else {
            void handleSave()
          }
        }
      }),
    ]

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe()
      }
    }
  }, [
    isStandalone,
    selectedEntityId,
    isEditing,
    isSaving,
    activeTab,
    handleSave,
    handleEnterEditMode,
  ])

  // Navigation handlers
  const currentEntityIndex = useMemo(() => {
    if (!selectedEntityId || !entities.length) return -1
    return entities.findIndex((e) => e.id === selectedEntityId)
  }, [selectedEntityId, entities])

  const handleNavigateFirst = useCallback(() => {
    if (entities.length === 0) return
    if (pagination && pagination.page !== 1) {
      // Navigate to first page
      fetchEntities(1).then(() => {
        // After fetching, select the first entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          selectEntity(state.entities[0])
          setFocusedEntityIndex(0)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, state.entities[0].id)
          }
        }
      })
    } else if (entities.length > 0) {
      // Select first entity on current page
      selectEntity(entities[0])
      setFocusedEntityIndex(0)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, entities[0].id)
      }
    }
  }, [
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  const handleNavigatePrev = useCallback(() => {
    if (entities.length === 0) return
    // No selection on this page (e.g. after pager change) — select last row.
    if (currentEntityIndex < 0) {
      const lastIndex = entities.length - 1
      const last = entities[lastIndex]
      selectEntity(last)
      setFocusedEntityIndex(lastIndex)
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, last.id)
      }
      return
    }
    if (currentEntityIndex > 0) {
      // Navigate to previous entity on current page
      const newIndex = currentEntityIndex - 1
      const prevEntity = entities[newIndex]
      selectEntity(prevEntity)
      setFocusedEntityIndex(newIndex)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, prevEntity.id)
      }
    } else if (pagination?.hasPrev) {
      // Navigate to last entity on previous page
      fetchEntities(pagination.page - 1).then(() => {
        // After fetching, select the last entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          const lastIndex = state.entities.length - 1
          const lastEntity = state.entities[lastIndex]
          selectEntity(lastEntity)
          setFocusedEntityIndex(lastIndex)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, lastEntity.id)
          }
        }
      })
    }
  }, [
    currentEntityIndex,
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  const handleNavigateNext = useCallback(() => {
    if (entities.length === 0) return
    // No selection on this page (e.g. after pager change) — select first row.
    if (currentEntityIndex < 0) {
      const first = entities[0]
      selectEntity(first)
      setFocusedEntityIndex(0)
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, first.id)
      }
      return
    }
    if (currentEntityIndex < entities.length - 1) {
      // Navigate to next entity on current page
      const newIndex = currentEntityIndex + 1
      const nextEntity = entities[newIndex]
      selectEntity(nextEntity)
      setFocusedEntityIndex(newIndex)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, nextEntity.id)
      }
    } else if (pagination?.hasNext) {
      // Navigate to first entity on next page
      fetchEntities(pagination.page + 1).then(() => {
        // After fetching, select the first entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          const firstEntity = state.entities[0]
          selectEntity(firstEntity)
          setFocusedEntityIndex(0)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, firstEntity.id)
          }
        }
      })
    }
  }, [
    currentEntityIndex,
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  const handleNavigateLast = useCallback(() => {
    if (entities.length === 0) return
    if (pagination && pagination.page !== pagination.totalPages) {
      // Navigate to last page
      fetchEntities(pagination.totalPages).then(() => {
        // After fetching, select the last entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          const lastIndex = state.entities.length - 1
          const lastEntity = state.entities[lastIndex]
          selectEntity(lastEntity)
          setFocusedEntityIndex(lastIndex)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, lastEntity.id)
          }
        }
      })
    } else if (entities.length > 0) {
      // Select last entity on current page
      const lastIndex = entities.length - 1
      const lastEntity = entities[lastIndex]
      selectEntity(lastEntity)
      setFocusedEntityIndex(lastIndex)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, lastEntity.id)
      }
    }
  }, [
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  // Listen for navigation events from keyboard shortcuts. Only the active tab
  // may handle these — dataclass tabs stay mounted (display:none), and
  // selectEntity/fetchEntities always write the active tab slice, so inactive
  // viewers would otherwise race and jump/clear the visible selection.
  useEffect(() => {
    if (isStandalone) return
    const isActiveTab = () => useTabsStore.getState().activeTabId === tabId
    const subscriptions = [
      eventBus.on('nav-prev', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigatePrev()
      }),
      eventBus.on('nav-next', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigateNext()
      }),
      eventBus.on('page-first', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigateFirst()
      }),
      eventBus.on('page-last', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigateLast()
      }),
    ]

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe()
      }
    }
  }, [
    isStandalone,
    isEditing,
    tabId,
    handleNavigatePrev,
    handleNavigateNext,
    handleNavigateFirst,
    handleNavigateLast,
  ])

  // Mobile: swipe sheet → next/prev entity (same as footer chevrons).
  const swipeEnabled = mobile && !isStandalone && !isEditing && !entitiesLoading
  const canSwipeNext =
    entities.length > 0 &&
    (currentEntityIndex < 0 ||
      currentEntityIndex < entities.length - 1 ||
      Boolean(pagination?.hasNext))
  const canSwipePrev =
    entities.length > 0 &&
    (currentEntityIndex < 0 || currentEntityIndex > 0 || Boolean(pagination?.hasPrev))

  if (!selectedEntity) {
    if (entitiesLoading || isLoadingDetails) {
      return <EntityDetailSkeleton className="h-full" />
    }
    return (
      <EmptyPanel
        icon={FileJson}
        badgeIcon={MousePointerClick}
        badgeTone="primary"
        title={t('entity.noEntitySelected')}
        description={t('entity.noEntitySelectedHint')}
        ghost="cards"
        size="lg"
        className="h-full min-h-0"
      />
    )
  }

  const entityMethods =
    selectedDataclass && selectedEntityId ? (
      <MethodListPopover
        dataClass={selectedDataclass}
        scopes={['entity']}
        entityKey={selectedEntityId}
        compact
      />
    ) : null

  return (
    <SwipeNavigate
      enabled={swipeEnabled}
      loading={entitiesLoading || isLoadingDetails}
      loadingLabel={t('entity.loading')}
      onSwipeLeft={handleNavigateNext}
      onSwipeRight={handleNavigatePrev}
      canSwipeLeft={canSwipeNext}
      canSwipeRight={canSwipePrev}
      nextLabel={t('command.nextEntity')}
      previousLabel={t('command.previousEntity')}
      className="@container/entity-viewer h-full"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-2 gap-y-1.5 border-b bg-background px-2 py-1.5">
          <div className="min-w-0 flex-1 basis-28">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {selectedEntityId ? (
                <ClickToCopy
                  as="code"
                  value={String(selectedEntityId)}
                  tooltipLabel={t('common.clickToCopy')}
                  tooltipCopiedLabel={t('common.copied')}
                  className="truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none"
                >
                  {selectedEntityId}
                </ClickToCopy>
              ) : (
                <code
                  className="truncate rounded-sm border border-muted-foreground/35 border-dashed bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground italic leading-none"
                  title={t('entity.noKeyHint')}
                >
                  {t('entity.noKey')}
                </code>
              )}
              <ClickToCopy
                value={JSON.stringify(selectedEntity, null, 2)}
                tooltipLabel={t('entity.copyJson')}
                tooltipCopiedLabel={t('common.copied')}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Copy className="h-3 w-3" />
              </ClickToCopy>
              {selectedDataclass && !mobile && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                        onClick={() => highlightInGraph(selectedDataclass)}
                        disabled={isLoadingDetails}
                      >
                        <Network className="h-3.5 w-3.5" />
                        <span className="@[32rem]/entity-viewer:inline hidden">
                          {t('entity.showInStructure')}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('entity.highlightDataclassInGraph')}
                      {openStructureShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(openStructureShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="mt-1">
              <EntityStats entity={selectedEntity} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
            {isLoadingDetails && (
              <Loader2
                className="mr-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                aria-label={t('entity.loading')}
              />
            )}
            {isEditing ? (
              // On mobile the sticky bottom action bar owns Cancel/Save so the
              // header stays uncluttered; desktop keeps them inline here.
              mobile ? null : (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                          onClick={() => {
                            setEditedEntity(JSON.stringify(selectedEntity, null, 2))
                            setFormData(selectedEntity ?? {})
                            setIsEditing(false)
                            setActiveTab(previousTab)
                            setError(null)
                          }}
                          disabled={isSaving}
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="@[28rem]/entity-viewer:inline hidden">
                            {t('entity.cancel')}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('entity.cancelEdit')}
                        {cancelEditShortcut?.enabled && (
                          <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                            {formatShortcut(cancelEditShortcut)}
                          </kbd>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          size="xs"
                          className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                          onClick={() => {
                            if (activeTab === 'form') {
                              formRef.current?.submit()
                            } else {
                              void handleSave()
                            }
                          }}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          <span className="@[28rem]/entity-viewer:inline hidden">
                            {t('entity.save')}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('entity.saveEntity')}
                        {saveEntityShortcut?.enabled && (
                          <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                            {formatShortcut(saveEntityShortcut)}
                          </kbd>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )
            ) : (
              <>
                {saveSuccessAt !== null && (
                  <output
                    className="flex h-6 items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 font-medium text-primary text-xs"
                    aria-live="polite"
                  >
                    <Check className="h-4 w-4 shrink-0" />
                    <span className="@[24rem]/entity-viewer:inline hidden">
                      {t('entity.saved')}
                    </span>
                  </output>
                )}
                {entityMethods}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="xs"
                        className={cn(
                          'gap-1 @[32rem]/entity-viewer:px-2 px-1.5',
                          mobile ? 'h-9' : 'h-6'
                        )}
                        onClick={() => void handleReloadEntity()}
                        disabled={
                          !selectedDataclass ||
                          !selectedEntityId ||
                          isReloadingEntity ||
                          isLoadingDetails
                        }
                      >
                        <RefreshCw
                          className={cn('h-3.5 w-3.5', isReloadingEntity && 'animate-spin')}
                        />
                        <span className="@[36rem]/entity-viewer:inline hidden">
                          {t('entity.reloadEntity')}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('entity.reloadEntity')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {!isStandalone ? (
                  <>
                    <div className="flex items-center rounded-sm border">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="xs"
                              className={cn(
                                'gap-1 rounded-r-none border-0 @[36rem]/entity-viewer:px-2 px-1.5',
                                mobile ? 'h-9' : 'h-6'
                              )}
                              onClick={() => handleEnterEditMode()}
                              disabled={readonlyMode || isLoadingDetails}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              <span className="@[36rem]/entity-viewer:inline hidden">
                                {defaultEditMode === 'json' && !mobile
                                  ? t('entity.editAsJson')
                                  : t('entity.editAsForm')}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          {readonlyMode ? (
                            <TooltipContent>{t('entity.disabledInReadonlyMode')}</TooltipContent>
                          ) : (
                            <TooltipContent>
                              {t('entity.editEntity')}
                              {editEntityShortcut?.enabled ? (
                                <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                                  {formatShortcut(editEntityShortcut)}
                                </kbd>
                              ) : null}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="xs"
                            className={cn(
                              'rounded-l-none border-0 border-l px-0',
                              mobile ? 'h-9 w-8' : 'h-6 w-5'
                            )}
                            disabled={readonlyMode || isLoadingDetails}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEnterEditMode('form')}>
                            <FileText className="mr-2 h-4 w-4" />
                            {t('entity.editAsForm')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEnterEditMode('json')}>
                            <Braces className="mr-2 h-4 w-4" />
                            {t('entity.editAsJson')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="xs"
                            className={cn(
                              'h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5',
                              readonlyMode ? 'cursor-not-allowed opacity-50' : 'text-destructive'
                            )}
                            onClick={() => !readonlyMode && handleDelete()}
                            disabled={readonlyMode || isLoadingDetails}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="@[32rem]/entity-viewer:inline hidden">
                              {t('entity.delete')}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {readonlyMode
                            ? t('entity.disabledInReadonlyMode')
                            : t('entity.deleteEntityTitle')}
                          {!readonlyMode && deleteEntityShortcut?.enabled ? (
                            <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                              {formatShortcut(deleteEntityShortcut)}
                            </kbd>
                          ) : null}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && <ErrorList error={error} variant="banner" onDismiss={() => setError(null)} />}

        {/* Content with tabs */}
        <Tabs
          value={isEditing && activeTab !== 'form' ? 'json' : activeTab}
          onValueChange={(v) => {
            if (isEditing && v !== 'form') {
              // When editing, only allow switching to form or staying in json
              if (v === 'tree') return
            }
            setActiveTab(v as 'tree' | 'json' | 'form')
            if (!isEditing) {
              setPreviousTab(v as 'tree' | 'json' | 'form')
            }
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center overflow-x-auto border-b bg-muted/30 px-2',
              mobile ? 'h-11' : 'h-8'
            )}
          >
            <TabsList className={cn('bg-transparent p-0', mobile ? 'h-9' : 'h-6')}>
              <TabsTrigger
                value="form"
                disabled={(isEditing && activeTab !== 'form') || isLoadingDetails}
                className={cn(
                  'relative gap-1 @[28rem]/entity-viewer:px-2 px-1.5 text-xs after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:after:bg-primary',
                  mobile ? 'h-9' : 'h-6'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="@[22rem]/entity-viewer:inline hidden">
                  {t('entity.formTab')}{' '}
                  {isEditing && activeTab === 'form' && t('entity.formEditing')}
                </span>
              </TabsTrigger>
              {!mobile && (
                <TabsTrigger
                  value="tree"
                  disabled={isEditing || isLoadingDetails}
                  className="relative h-6 gap-1 @[28rem]/entity-viewer:px-2 px-1.5 text-xs after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:after:bg-primary"
                >
                  <TreePine className="h-3.5 w-3.5" />
                  <span className="@[22rem]/entity-viewer:inline hidden">
                    {t('entity.treeView')}
                  </span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="json"
                disabled={isLoadingDetails}
                className={cn(
                  'relative gap-1 @[28rem]/entity-viewer:px-2 px-1.5 text-xs after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:after:bg-primary',
                  mobile ? 'h-9' : 'h-6'
                )}
              >
                <Braces className="h-3.5 w-3.5" />
                <span className="@[22rem]/entity-viewer:inline hidden">
                  {t('entity.jsonTab')}{' '}
                  {isEditing && activeTab === 'json' && t('entity.formEditing')}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tree" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-full min-h-0 flex-col">
              {/* Tree controls */}
              <div className="flex items-center justify-end gap-1 border-b bg-muted/20 px-3 py-1.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => setExpandAll(true)}
                        disabled={isLoadingDetails}
                      >
                        <ChevronsUpDown className="h-3.5 w-3.5" />
                        {t('entity.expandAll')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('entity.expandAllNodes')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => setExpandAll(false)}
                        disabled={isLoadingDetails}
                      >
                        <ChevronsDownUp className="h-3.5 w-3.5" />
                        {t('entity.collapseAll')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('entity.collapseAllNodes')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <MetadataPanel
                    entries={Object.entries(selectedEntity).filter(([key]) =>
                      isInternalAttribute(key)
                    )}
                    expandAll={expandAll}
                  />
                  {Object.entries(selectedEntity)
                    .filter(([key]) => !isInternalAttribute(key))
                    .map(([key, value]) => (
                      <TreeNode key={key} keyName={key} value={value} expandAll={expandAll} />
                    ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="form" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
            {isEditing && selectedDataclass ? (
              <div className="flex h-full min-h-0 flex-col p-4">
                <EntityForm
                  ref={formRef}
                  dataclassName={selectedDataclass}
                  initialData={formData}
                  mode="edit"
                  entityId={selectedEntityId}
                  onSubmit={handleSaveFromForm}
                  scrollHeight="100%"
                  fieldIdPrefix="entity-viewer-edit"
                  onSubmittingChange={setIsSaving}
                  showError={false}
                  autoFocusFirstField
                />
              </div>
            ) : (
              <FormView
                entity={selectedEntity ?? {}}
                dataclassName={selectedDataclass}
                isEditing={false}
                readonlyMode={readonlyMode}
                onFieldChange={handleFormFieldChange}
                entityId={selectedEntityId}
                onRefresh={handleReloadEntity}
              />
            )}
          </TabsContent>

          <TabsContent
            value="json"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
          >
            <CodeEditor
              value={editedEntity}
              onChange={setEditedEntity}
              readOnly={!isEditing}
              showLineNumbers
              highlightActiveLine={isEditing}
              error={!!error}
              height="100%"
              toolbar={isEditing}
              labels={editorLabels}
              editorPrefs={codeEditorPrefs}
              onEditorPrefsChange={updateCodeEditorPrefs}
            />
          </TabsContent>
        </Tabs>

        {/* Sticky mobile edit action bar — replaces the header Cancel/Save above */}
        {mobile && isEditing ? (
          <div className="flex shrink-0 items-center gap-2 border-t bg-background p-3 pb-[max(0.75rem,var(--app-safe-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 gap-1.5"
              onClick={() => {
                setEditedEntity(JSON.stringify(selectedEntity, null, 2))
                setFormData(selectedEntity ?? {})
                setIsEditing(false)
                setActiveTab(previousTab)
                setError(null)
              }}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              {t('entity.cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              className="h-11 flex-1 gap-1.5"
              onClick={() => {
                if (activeTab === 'form') {
                  formRef.current?.submit()
                } else {
                  void handleSave()
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('entity.save')}
            </Button>
          </div>
        ) : null}

        {/* Navigation Bar — hidden while the mobile sticky edit bar is showing */}
        {!isStandalone && entities.length > 0 && !(mobile && isEditing) ? (
          <div className="flex h-9 shrink-0 items-center justify-between border-t bg-muted/30 px-2">
            <div className="min-w-0 truncate text-muted-foreground text-xs">
              {currentEntityIndex >= 0 && (
                <>
                  {t('entity.entityOfTotal', {
                    current: currentEntityIndex + 1,
                    total: entities.length,
                  })}
                  {pagination && (
                    <>
                      {' '}
                      <span className="mx-1 text-muted-foreground/50">•</span>{' '}
                      {t('entity.pageOf', {
                        page: pagination.page,
                        total: pagination.totalPages,
                      })}
                    </>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleNavigateFirst}
                      disabled={
                        (currentEntityIndex <= 0 && (!pagination || pagination.page === 1)) ||
                        isEditing ||
                        isLoadingDetails
                      }
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    First entity
                    {pageFirstShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(pageFirstShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleNavigatePrev}
                      disabled={
                        (currentEntityIndex <= 0 && !pagination?.hasPrev) ||
                        isEditing ||
                        isLoadingDetails
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Previous entity
                    {navPrevShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(navPrevShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleNavigateNext}
                      disabled={
                        (currentEntityIndex >= entities.length - 1 && !pagination?.hasNext) ||
                        isEditing ||
                        isLoadingDetails
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Next entity
                    {navNextShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(navNextShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleNavigateLast}
                      disabled={
                        (currentEntityIndex >= entities.length - 1 &&
                          (!pagination || pagination.page === pagination.totalPages)) ||
                        isEditing ||
                        isLoadingDetails
                      }
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Last entity
                    {pageLastShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(pageLastShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ) : null}

        {!isStandalone ? <ConfirmDialog /> : null}
      </div>
    </SwipeNavigate>
  )
}
