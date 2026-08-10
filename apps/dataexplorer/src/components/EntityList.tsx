import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
  useToast,
} from '@4d/ui'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutGrid,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Table2,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiActionsMenu } from '~/components/AiActions'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { EntityListSkeleton } from '~/components/EntityLoadingSkeleton'
import { PullToRefresh } from '~/components/PullToRefresh'
import { SwipeNavigate } from '~/components/SwipeNavigate'
import { useTranslation } from '~/i18n'
import { api, coerceFilterParams, formatThrownError } from '~/lib/api'
import { sanitizeForDuplication } from '~/lib/entitySanitizer'
import { eventBus } from '~/lib/eventBus'
import { findEntityPageByKey, resolveKeyAttribute } from '~/lib/find-entity-page'
import { isMobileShell } from '~/lib/platform'
import {
  columnPresetTableNames,
  deleteColumnPreset,
  getColumnPreset,
  saveColumnPreset,
  saveColumnWidth,
} from '~/lib/storage'
import { formatCount } from '~/lib/utils'
import { useKeyboardShortcutsContext } from '~/providers/KeyboardShortcutsProvider'
import { type Entity, useDataExplorerStore } from '~/store'
import { formatShortcut, useReadonlyMode, useShortcut } from '~/store/settings'
import {
  type FieldConfig,
  isDataclassTab,
  normalizeFieldConfig,
  normalizeQueryOptions,
  useTabsStore,
} from '~/store/tabs'
import { CreateEntityDialog } from './CreateEntityDialog'
import { EntityCard } from './EntityCard'
import { EntityDataGrid } from './EntityDataGrid'
import { FieldManager } from './FieldManager'
import { MethodListPopover } from './MethodExecutor/MethodListPopover'
import { QueryBuilder } from './QueryBuilder/index'
import { QueryTopSelector } from './QueryTopSelector'
import { ResizableVerticalHandle } from './ResizablePanel'

type ViewMode = 'cards' | 'table'

const EMPTY_ENTITIES: Entity[] = []

export function EntityList({ tabId }: { tabId: string }) {
  const {
    dataclasses,
    selectEntity,
    fetchEntities,
    deleteEntity,
    deleteManyEntities,
    createEntity,
    updateEntity,
    refreshApp,
    fetchDataclassCount,
  } = useDataExplorerStore()

  // This list renders a specific tab (kept mounted across tab switches), so it
  // reads its own tab and cached entity slice rather than the active-tab mirror.
  const activeTab = useTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab && isDataclassTab(tab) ? tab : null
  })
  const selectedDataclass = activeTab?.dataclassName ?? null
  const view = useDataExplorerStore((s) => s.tabData[tabId])
  const entities = view?.entities ?? EMPTY_ENTITIES
  // No cached slice yet means the tab is still doing its initial fetch.
  const entitiesLoading = view ? view.entitiesLoading : true
  const entitiesError = view?.entitiesError ?? null
  const pagination = view?.pagination ?? null

  // Get total count for the current dataclass
  const dataclassTotalCount = useMemo(() => {
    if (!selectedDataclass) return null
    const dc = dataclasses.find((d) => d.name === selectedDataclass)
    return dc?.count ?? null
  }, [dataclasses, selectedDataclass])

  // Opening a table is an explicit ask to know its size when counts were deferred.
  useEffect(() => {
    if (!selectedDataclass || dataclassTotalCount !== null) return
    void fetchDataclassCount(selectedDataclass)
  }, [selectedDataclass, dataclassTotalCount, fetchDataclassCount])

  const setViewMode = useTabsStore((s) => s.setViewMode)

  const setSelectedEntityId = useTabsStore((s) => s.setSelectedEntityId)
  const setQueryOptions = useTabsStore((s) => s.setQueryOptions)
  const setFieldConfig = useTabsStore((s) => s.setFieldConfig)
  const openGraphTab = useTabsStore((s) => s.openGraphTab)
  const resetQueryOptions = useTabsStore((s) => s.resetQueryOptions)
  const setEntitySetId = useTabsStore((s) => s.setEntitySetId)
  const setQueryPanelHeight = useTabsStore((s) => s.setQueryPanelHeight)
  const closeTab = useTabsStore((s) => s.closeTab)
  const mobile = isMobileShell()
  // Mobile always browses in cards — table view is desktop-only real estate.
  const viewMode: ViewMode = mobile ? 'cards' : (activeTab?.viewMode ?? 'cards')
  const queryExpanded = activeTab?.queryExpanded ?? false
  const queryPanelHeight = activeTab?.queryPanelHeight ?? null
  const queryTop = activeTab ? normalizeQueryOptions(activeTab.queryOptions).top : 100

  const handleQueryPanelResize = useCallback(
    (delta: number) => {
      if (!activeTab) return
      const panel = document.querySelector<HTMLElement>('[data-query-builder-panel]')
      const measured = panel?.getBoundingClientRect().height
      const base =
        queryPanelHeight ??
        (measured != null
          ? Math.round(measured)
          : Math.min(Math.round(window.innerHeight * 0.45), 448))
      const maxHeight = Math.round(window.innerHeight * 0.7)
      const next = Math.min(maxHeight, Math.max(160, Math.round(base + delta)))
      setQueryPanelHeight(activeTab.id, next)
    },
    [activeTab, queryPanelHeight, setQueryPanelHeight]
  )

  const handleQueryPanelReset = useCallback(() => {
    if (!activeTab) return
    setQueryPanelHeight(activeTab.id, null)
  }, [activeTab, setQueryPanelHeight])

  const handleTopChange = useCallback(
    (top: number) => {
      if (!activeTab) return
      const nextOptions = normalizeQueryOptions({ ...activeTab.queryOptions, top })
      setQueryOptions(activeTab.id, { top })
      void fetchEntities(1, nextOptions)
    },
    [activeTab, fetchEntities, setQueryOptions]
  )

  const queryOptionsNormalized = activeTab ? normalizeQueryOptions(activeTab.queryOptions) : null
  const sortColumn = queryOptionsNormalized?.sort || null
  const sortOrder = queryOptionsNormalized?.order ?? 'asc'

  const handleSortChange = useCallback(
    (column: string | null, order: 'asc' | 'desc') => {
      if (!activeTab) return
      const sort = column ?? ''
      const nextOptions = normalizeQueryOptions({ ...activeTab.queryOptions, sort, order })
      setQueryOptions(activeTab.id, { sort, order })
      void fetchEntities(1, nextOptions)
    },
    [activeTab, fetchEntities, setQueryOptions]
  )

  const handleHighlightInGraph = useCallback(() => {
    if (!selectedDataclass) return
    openGraphTab().then(() => {
      eventBus.emit('highlight-dataclass-in-graph', selectedDataclass)
    })
  }, [selectedDataclass, openGraphTab])

  // Retry the current query as-is (useful for transient failures).
  const handleRetry = useCallback(() => {
    if (!activeTab) return
    void fetchEntities(activeTab.entitiesPage || 1)
  }, [activeTab, fetchEntities])

  // Clear the filter/sort/select and any bound entity set, then reload from the
  // first page. Recovers from invalid queries or stale entity set IDs.
  const handleResetQuery = useCallback(() => {
    if (!activeTab) return
    resetQueryOptions(activeTab.id)
    setEntitySetId(activeTab.id, null)
    void fetchEntities(1, {
      filter: '',
      filterParams: [],
      sort: '',
      order: 'desc',
      select: '',
      top: queryTop,
    })
  }, [activeTab, resetQueryOptions, setEntitySetId, fetchEntities, queryTop])

  const handleCloseTab = useCallback(() => {
    if (!activeTab) return
    closeTab(activeTab.id)
  }, [activeTab, closeTab])

  // Use per-tab selected entity id instead of global
  const selectedEntityId = activeTab?.selectedEntityId ?? null

  // Per-tab field selection (table columns + card fields). Each list holds
  // ordered, possibly dotted attribute paths (e.g. "company.name").
  const fieldConfig = useMemo<FieldConfig>(
    () => normalizeFieldConfig(activeTab?.fieldConfig),
    [activeTab?.fieldConfig]
  )
  // Bumped after saving/clearing a default preset so the dirty indicator refreshes.
  const [presetVersion, setPresetVersion] = useState(0)

  // The set of requested attributes (union of both views). Reorders within a
  // view don't change this, so they don't trigger a refetch.
  const fieldsUnionKey = useCallback(
    (fc: FieldConfig) =>
      Array.from(new Set([...fc.table, ...fc.cards]))
        .sort()
        .join('\u0000'),
    []
  )

  const handleFieldsChange = useCallback(
    (targetView: ViewMode, fields: string[]) => {
      if (!activeTab) return
      const before = fieldsUnionKey(fieldConfig)
      const nextConfig = normalizeFieldConfig({ ...fieldConfig, [targetView]: fields })
      setFieldConfig(activeTab.id, { [targetView]: fields })
      setPresetVersion((v) => v + 1)
      // Only refetch when the requested attribute set actually changed (add/remove),
      // not when the user merely reorders already-loaded fields.
      if (before !== fieldsUnionKey(nextConfig)) {
        void fetchEntities(1)
      }
    },
    [activeTab, fieldConfig, fieldsUnionKey, setFieldConfig, fetchEntities]
  )

  const handleResetFieldsView = useCallback(
    (targetView: ViewMode) => {
      handleFieldsChange(targetView, [])
    },
    [handleFieldsChange]
  )

  const handleSaveFieldDefault = useCallback(() => {
    if (!selectedDataclass) return
    if (fieldConfig.table.length === 0 && fieldConfig.cards.length === 0) {
      deleteColumnPreset(selectedDataclass)
    } else {
      // Preserve any widths already saved for these columns when re-saving the default.
      const existing = getColumnPreset(selectedDataclass)
      const widthByName = new Map(existing?.table.map((col) => [col.name, col.width]))
      saveColumnPreset(selectedDataclass, {
        table: fieldConfig.table.map((name) => {
          const width = widthByName.get(name)
          return width != null ? { name, width } : { name }
        }),
        cards: fieldConfig.cards,
      })
    }
    setPresetVersion((v) => v + 1)
  }, [selectedDataclass, fieldConfig])

  const isFieldConfigDirtyFromDefault = useMemo(() => {
    if (!selectedDataclass) return false
    void presetVersion
    const preset = getColumnPreset(selectedDataclass)
    const presetTable = columnPresetTableNames(preset).join('\u0000')
    const presetCards = (preset?.cards ?? []).join('\u0000')
    return (
      presetTable !== fieldConfig.table.join('\u0000') ||
      presetCards !== fieldConfig.cards.join('\u0000')
    )
  }, [selectedDataclass, fieldConfig, presetVersion])

  // Saved per-column widths for the current dataclass, applied by the grid so
  // manual resizes are restored across page navigation and reloads.
  const columnWidths = useMemo<Record<string, number>>(() => {
    void presetVersion
    if (!selectedDataclass) return {}
    const preset = getColumnPreset(selectedDataclass)
    const map: Record<string, number> = {}
    for (const col of preset?.table ?? []) {
      if (col.width != null) {
        map[col.name] = col.width
      }
    }
    return map
  }, [selectedDataclass, presetVersion])

  const handleColumnWidthChange = useCallback(
    (columnName: string, width: number) => {
      if (!selectedDataclass) return
      saveColumnWidth(selectedDataclass, columnName, width)
    },
    [selectedDataclass]
  )

  const { focusedEntityIndex, setFocusedEntityIndex } = useKeyboardShortcutsContext()
  const entityRefs = useRef<Map<string, HTMLDivElement | HTMLTableRowElement>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  // When an entity is selected (e.g. Terminal "Open entity") but not on the
  // current page, jump to the page that contains it (key-ordered queries only).
  // Only auto-page when the selection itself changes — not when the user pages away.
  const revealAttemptRef = useRef<string | null>(null)
  const prevSelectedEntityIdRef = useRef<string | null>(null)
  const activeTabId = useTabsStore((s) => s.activeTabId)

  useEffect(() => {
    if (activeTabId !== tabId) return
    if (!selectedDataclass || !activeTab) return
    if (activeTab.entitySetId) return

    if (!selectedEntityId) {
      prevSelectedEntityIdRef.current = null
      revealAttemptRef.current = null
      return
    }

    const indexOnPage = entities.findIndex(
      (entity) =>
        String(entity.id) === selectedEntityId || String(entity.__KEY) === selectedEntityId
    )
    if (indexOnPage >= 0) {
      revealAttemptRef.current = null
      prevSelectedEntityIdRef.current = selectedEntityId
      setFocusedEntityIndex(indexOnPage)
      const matched = entities[indexOnPage]
      if (matched && view?.selectedEntityId !== selectedEntityId) {
        selectEntity(matched)
      }
      return
    }

    if (entitiesLoading) return

    const selectionChanged = prevSelectedEntityIdRef.current !== selectedEntityId
    prevSelectedEntityIdRef.current = selectedEntityId
    if (!selectionChanged) return
    if (revealAttemptRef.current === selectedEntityId) return
    revealAttemptRef.current = selectedEntityId

    const query = normalizeQueryOptions(activeTab.queryOptions)
    const targetKey = selectedEntityId

    void (async () => {
      const keyAttribute = await resolveKeyAttribute(selectedDataclass)
      if (!keyAttribute) return
      const page = await findEntityPageByKey({
        dataclassName: selectedDataclass,
        entityKey: targetKey,
        pageSize: query.top,
        keyAttribute,
        filter: query.filter || undefined,
        filterParams: query.filterParams?.length
          ? coerceFilterParams(query.filterParams)
          : undefined,
        sort: query.sort || undefined,
        order: query.order,
      })
      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab || !isDataclassTab(tab) || tab.selectedEntityId !== targetKey) return
      if (page == null) {
        // Allow a later retry (e.g. after catalog/key resolution recovers).
        if (revealAttemptRef.current === targetKey) revealAttemptRef.current = null
        return
      }
      const currentPage = useDataExplorerStore.getState().tabData[tabId]?.pagination?.page
      if (currentPage === page) return
      void fetchEntities(page)
    })()
  }, [
    activeTabId,
    tabId,
    selectedEntityId,
    selectedDataclass,
    activeTab,
    entities,
    entitiesLoading,
    setFocusedEntityIndex,
    selectEntity,
    fetchEntities,
    view?.selectedEntityId,
  ])

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [duplicateData, setDuplicateData] = useState<Record<string, unknown> | undefined>(undefined)
  // Only one card can show its remaining fields at a time
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [schema, setSchema] = useState<
    Array<{ name: string; type: string; kind?: string; behavior?: string }> | undefined
  >(undefined)
  const { confirm, ConfirmDialog } = useConfirm()
  const toast = useToast()

  // Fetch schema when dataclass changes
  useEffect(() => {
    if (!selectedDataclass) {
      setSchema(undefined)
      return
    }

    let cancelled = false
    api
      .getDataclassSchema(selectedDataclass)
      .then((result: Awaited<ReturnType<typeof api.getDataclassSchema>>) => {
        if (!cancelled) {
          setSchema(result.attributes)
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch schema:', error)
        if (!cancelled) {
          setSchema(undefined)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedDataclass])

  // Readonly mode
  const readonlyMode = useReadonlyMode()

  // Page navigation shortcuts
  const pageFirstShortcut = useShortcut('page-first')
  const pagePrevShortcut = useShortcut('page-prev')
  const pageNextShortcut = useShortcut('page-next')
  const pageLastShortcut = useShortcut('page-last')
  const viewCardsShortcut = useShortcut('view-cards')
  const viewTableShortcut = useShortcut('view-table')
  const refreshShortcut = useShortcut('refresh')
  const newEntityShortcut = useShortcut('new-entity')
  const duplicateEntityShortcut = useShortcut('duplicate-entity')
  const deleteEntityShortcut = useShortcut('delete-entity')
  const openStructureShortcut = useShortcut('open-structure')
  const { t } = useTranslation()

  // Scroll focused entity into view
  useEffect(() => {
    if (focusedEntityIndex >= 0 && entities[focusedEntityIndex]) {
      const entityId = entities[focusedEntityIndex].id
      const element = entityRefs.current.get(entityId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [focusedEntityIndex, entities])

  // Handle entity selection - updates both the selection and the focused index
  const handleSelectEntity = useCallback(
    (entity: Entity, index: number) => {
      selectEntity(entity)
      setFocusedEntityIndex(index)
      // Also update per-tab selected entity ID
      if (activeTab) {
        setSelectedEntityId(activeTab.id, entity.id)
      }
    },
    [selectEntity, setFocusedEntityIndex, activeTab, setSelectedEntityId]
  )

  const handleCopyJson = useCallback((entity: Entity) => {
    navigator.clipboard.writeText(JSON.stringify(entity, null, 2))
  }, [])

  const handleCreateEntity = useCallback((initialData?: Record<string, unknown>) => {
    setDuplicateData(initialData)
    setShowCreateDialog(true)
  }, [])

  const handleDuplicate = useCallback(
    async (entity: Entity) => {
      const filtered = await sanitizeForDuplication(entity, selectedDataclass)
      handleCreateEntity(filtered)
    },
    [selectedDataclass, handleCreateEntity]
  )

  const showActionError = useCallback(
    (title: string, error: unknown, fallback: string) => {
      const reason = formatThrownError(error, fallback)
      console.error(title, error)
      toast.error(title, {
        description: t('entity.actionErrorReason', { reason }),
      })
    },
    [t, toast]
  )

  const handleDeleteEntity = useCallback(
    async (entity: Entity) => {
      if (!selectedDataclass) return
      const id = entity.id

      const confirmed = await confirm({
        title: t('command.deleteEntity'),
        description: (
          <div className="space-y-4">
            <p>{t('entity.deleteConfirmDescription')}</p>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground text-sm">
                <strong>{t('entity.keyLabel')}</strong> {id}
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
        await deleteEntity(id)
      } catch (error) {
        showActionError(
          t('entity.deleteEntityErrorTitle', {
            dataclass: selectedDataclass,
            key: id,
          }),
          error,
          t('entity.failedToDeleteEntity')
        )
      }
    },
    [selectedDataclass, deleteEntity, confirm, showActionError, t]
  )

  const [batchDeleting, setBatchDeleting] = useState(false)
  const entitySetId = activeTab?.entitySetId ?? null
  const selectionCount = activeTab?.selectionCount ?? pagination?.total ?? null
  const pageKeys = useMemo(
    () =>
      entities
        .map((entity) => String(entity.__KEY ?? entity.id ?? ''))
        .filter((key) => key.length > 0),
    [entities]
  )
  const pageCount = pageKeys.length
  const allCount = dataclassTotalCount ?? 0

  const handleDeleteMany = useCallback(
    async (scope: 'page' | 'selection' | 'all') => {
      if (!selectedDataclass || readonlyMode) return

      if (scope === 'page') {
        if (pageKeys.length === 0) return
        const confirmed = await confirm({
          title: t('entity.deleteManyPageTitle'),
          description: t('entity.deleteManyConfirmPage', { count: pageKeys.length }),
          confirmText: t('entity.delete'),
          variant: 'destructive',
          icon: <Trash2 className="h-5 w-5 text-destructive" />,
        })
        if (!confirmed) return
        setBatchDeleting(true)
        try {
          await deleteManyEntities({ keys: pageKeys })
        } catch (error) {
          showActionError(
            t('entity.deleteManyPageErrorTitle', { count: pageKeys.length }),
            error,
            t('entity.failedToDeleteMany')
          )
        } finally {
          setBatchDeleting(false)
        }
        return
      }

      if (scope === 'selection') {
        if (!entitySetId) return
        const count = selectionCount ?? 0
        const confirmed = await confirm({
          title: t('entity.deleteManySelectionTitle'),
          description: t('entity.deleteManyConfirmSelection', { count }),
          confirmText: t('entity.delete'),
          variant: 'destructive',
          icon: <Trash2 className="h-5 w-5 text-destructive" />,
        })
        if (!confirmed) return
        setBatchDeleting(true)
        try {
          await deleteManyEntities({ entitySetId })
        } catch (error) {
          showActionError(
            t('entity.deleteManySelectionErrorTitle'),
            error,
            t('entity.failedToDeleteMany')
          )
        } finally {
          setBatchDeleting(false)
        }
        return
      }

      const confirmed = await confirm({
        title: t('entity.deleteManyAllTitle'),
        description: t('entity.deleteManyConfirmAll', {
          count: allCount,
          dataclass: selectedDataclass,
        }),
        confirmText: t('entity.delete'),
        variant: 'destructive',
        icon: <Trash2 className="h-5 w-5 text-destructive" />,
      })
      if (!confirmed) return
      setBatchDeleting(true)
      try {
        await deleteManyEntities({ all: true })
      } catch (error) {
        showActionError(
          t('entity.deleteManyAllErrorTitle', { dataclass: selectedDataclass }),
          error,
          t('entity.failedToDeleteMany')
        )
      } finally {
        setBatchDeleting(false)
      }
    },
    [
      selectedDataclass,
      readonlyMode,
      pageKeys,
      entitySetId,
      selectionCount,
      allCount,
      confirm,
      deleteManyEntities,
      showActionError,
      t,
    ]
  )

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (activeTab) {
        setViewMode(activeTab.id, mode)
      }
    },
    [activeTab, setViewMode]
  )

  // Handle go-to-entity navigation (by 1-based index)
  const handleGoToEntity = useCallback(
    async (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const { page, positionInPage } = payload as {
        index: number
        page: number
        positionInPage: number
      }

      await fetchEntities(page)

      setTimeout(() => {
        const currentEntities = useDataExplorerStore.getState().entities
        if (currentEntities[positionInPage]) {
          selectEntity(currentEntities[positionInPage])
          setFocusedEntityIndex(positionInPage)
          if (activeTab) {
            setSelectedEntityId(activeTab.id, currentEntities[positionInPage].id)
          }
        }
      }, 100)
    },
    [fetchEntities, selectEntity, setFocusedEntityIndex, activeTab, setSelectedEntityId]
  )

  // Handle go-to-page navigation
  const handleGoToPage = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const { page } = payload as { page: number }
      if (!Number.isFinite(page) || page < 1) return
      if (pagination && page > pagination.totalPages) return
      if (pagination && page === pagination.page) return
      fetchEntities(page)
    },
    [fetchEntities, pagination]
  )

  // Listen for keyboard shortcut events. Guard on activeTabId so mounted-but-
  // hidden dataclass tabs do not fetch/delete against the visible tab's data.
  useEffect(() => {
    const isActiveTab = () => useTabsStore.getState().activeTabId === tabId
    const subscriptions = [
      eventBus.on('new-entity', () => {
        if (!isActiveTab()) return
        handleCreateEntity()
      }),
      eventBus.on('delete-entity', () => {
        if (!isActiveTab()) return
        if (selectedEntityId) {
          const entity = entities.find((e) => e.id === selectedEntityId)
          if (entity) handleDeleteEntity(entity)
        }
      }),
      eventBus.on('duplicate-entity', () => {
        if (!isActiveTab()) return
        if (selectedEntityId) {
          const entity = entities.find((e) => e.id === selectedEntityId)
          if (entity) handleDuplicate(entity)
        }
      }),
      eventBus.on('go-to-entity', (payload) => {
        if (!isActiveTab()) return
        handleGoToEntity(payload)
      }),
      eventBus.on('go-to-page', (payload) => {
        if (!isActiveTab()) return
        handleGoToPage(payload)
      }),
      eventBus.on('page-first', () => {
        if (!isActiveTab()) return
        if (pagination && pagination.page !== 1) {
          fetchEntities(1)
        }
      }),
      eventBus.on('page-prev', () => {
        if (!isActiveTab()) return
        if (pagination?.hasPrev) {
          fetchEntities(pagination.page - 1)
        }
      }),
      eventBus.on('page-next', () => {
        if (!isActiveTab()) return
        if (pagination?.hasNext) {
          fetchEntities(pagination.page + 1)
        }
      }),
      eventBus.on('page-last', () => {
        if (!isActiveTab()) return
        if (pagination && pagination.page !== pagination.totalPages) {
          fetchEntities(pagination.totalPages)
        }
      }),
    ]

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe()
      }
    }
  }, [
    tabId,
    selectedEntityId,
    entities,
    handleDeleteEntity,
    handleCreateEntity,
    handleDuplicate,
    handleGoToEntity,
    handleGoToPage,
    pagination,
    fetchEntities,
  ])

  const handlePagePrev = useCallback(() => {
    if (entitiesLoading || !pagination?.hasPrev) return
    void fetchEntities(pagination.page - 1)
  }, [entitiesLoading, pagination, fetchEntities])

  const handlePageNext = useCallback(() => {
    if (entitiesLoading || !pagination?.hasNext) return
    void fetchEntities(pagination.page + 1)
  }, [entitiesLoading, pagination, fetchEntities])

  // Mobile: swipe sheet → next/prev page.
  const pageSwipeEnabled = mobile && !entitiesLoading
  const canSwipeNextPage = Boolean(pagination?.hasNext)
  const canSwipePrevPage = Boolean(pagination?.hasPrev)

  if (!selectedDataclass) return null

  return (
    <SwipeNavigate
      enabled={pageSwipeEnabled}
      loading={entitiesLoading}
      loadingLabel={t('entity.loadingEntities')}
      onSwipeLeft={handlePageNext}
      onSwipeRight={handlePagePrev}
      canSwipeLeft={canSwipeNextPage}
      canSwipeRight={canSwipePrevPage}
      nextLabel={t('command.nextPage')}
      previousLabel={t('command.previousPage')}
      className="@container/entity-list h-full"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b bg-background px-2 py-1.5">
          <div className="min-w-0 flex-1 basis-32">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold text-xs">{selectedDataclass}</h3>
              {!mobile && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconXs"
                        className="h-6 w-6 shrink-0"
                        onClick={handleHighlightInGraph}
                      >
                        <Network className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Highlight in graph
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
            <p className="text-[11px] text-muted-foreground leading-tight">
              {pagination
                ? `${formatCount(pagination.total)} ${t('entity.entities')}`
                : t('entity.loading')}
            </p>
          </div>
          <div
            className={cn(
              'flex max-w-full flex-wrap items-center justify-end gap-1',
              mobile && 'gap-1.5'
            )}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className={cn(
                      'gap-1 @[28rem]/entity-list:px-2 px-1.5',
                      mobile ? 'h-9 w-9 px-0' : 'h-6'
                    )}
                    onClick={() => eventBus.emit('refresh-view')}
                    disabled={entitiesLoading}
                  >
                    {entitiesLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="@[28rem]/entity-list:hidden h-3.5 w-3.5" />
                        <span className="@[28rem]/entity-list:inline hidden">
                          {t('entity.refresh')}
                        </span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('entity.refresh')}
                  {refreshShortcut?.enabled && (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(refreshShortcut)}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* View mode toggle — mobile always browses in cards, so hide it */}
            {!mobile && (
              <div className="flex h-6 items-center rounded-sm border bg-muted/40 p-px">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconXs"
                        onClick={() => handleViewModeChange('cards')}
                        className={cn(
                          'h-5! w-5! rounded-sm p-0 transition-colors',
                          viewMode === 'cards'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground'
                        )}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('command.cardView')}
                      {viewCardsShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(viewCardsShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconXs"
                        onClick={() => handleViewModeChange('table')}
                        className={cn(
                          'h-5! w-5! rounded-sm p-0 transition-colors',
                          viewMode === 'table'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground'
                        )}
                      >
                        <Table2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('command.tableView')}
                      {viewTableShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(viewTableShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {!readonlyMode && selectedDataclass ? (
              <DropdownMenu>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className={cn(
                            'gap-1 border-destructive/40 @[28rem]/entity-list:px-2 px-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive',
                            mobile ? 'h-9' : 'h-6'
                          )}
                          disabled={
                            batchDeleting || (pageCount === 0 && !entitySetId && allCount === 0)
                          }
                          aria-label={t('entity.deleteMany')}
                        >
                          {batchDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="@[28rem]/entity-list:inline hidden">
                            {t('entity.deleteMany')}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t('entity.deleteMany')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    disabled={pageCount === 0 || batchDeleting}
                    onClick={() => void handleDeleteMany('page')}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{t('entity.deleteManyPage')}</span>
                    <span className="text-muted-foreground text-xs">
                      {pageCount > 0
                        ? t('entity.deleteManyPageDescription', { count: pageCount })
                        : t('entity.deleteManyEmpty')}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!entitySetId || batchDeleting}
                    onClick={() => void handleDeleteMany('selection')}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{t('entity.deleteManySelection')}</span>
                    <span className="text-muted-foreground text-xs">
                      {entitySetId
                        ? t('entity.deleteManySelectionDescription', {
                            count: selectionCount ?? 0,
                          })
                        : t('entity.deleteManySelectionUnavailable')}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={batchDeleting}
                    onClick={() => void handleDeleteMany('all')}
                    className="flex flex-col items-start gap-0.5 text-destructive focus:text-destructive"
                  >
                    <span className="font-medium">{t('entity.deleteManyAll')}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('entity.deleteManyAllDescription', {
                        count: allCount,
                        dataclass: selectedDataclass,
                      })}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="xs"
                    className={cn('gap-1 @[28rem]/entity-list:px-2 px-1.5', mobile ? 'h-9' : 'h-6')}
                    onClick={() => handleCreateEntity()}
                    disabled={readonlyMode}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="@[28rem]/entity-list:inline hidden">{t('entity.new')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('entity.newEntity')}
                  {newEntityShortcut?.enabled && (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(newEntityShortcut)}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Secondary tools share the same compact height as primary actions */}
            {selectedDataclass && (
              <FieldManager
                dataclassName={selectedDataclass}
                fieldConfig={fieldConfig}
                initialView={viewMode}
                onChangeFields={handleFieldsChange}
                onResetView={handleResetFieldsView}
                onSaveDefault={handleSaveFieldDefault}
                isDirtyFromDefault={isFieldConfigDirtyFromDefault}
              />
            )}

            <MethodListPopover
              dataClass={selectedDataclass}
              scopes={['dataclass', 'entitySelection', 'entity']}
              entityKey={selectedEntityId}
              entitySetId={activeTab?.entitySetId}
              compact
            />

            {selectedDataclass ? (
              <AiActionsMenu dataclassName={selectedDataclass} variant="icon" />
            ) : null}
          </div>
        </div>

        <QueryBuilder />
        {queryExpanded && !mobile ? (
          <ResizableVerticalHandle
            onResize={handleQueryPanelResize}
            onDoubleClick={handleQueryPanelReset}
          />
        ) : null}

        {/* Content Area */}
        {entitiesLoading && entities.length === 0 ? (
          <EntityListSkeleton label={t('entity.loadingEntities')} />
        ) : entitiesError ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-destructive/20 bg-card shadow-lg">
              {/* Accent glow bleeding from the top of the card */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-destructive/10"
              />
              <div className="relative flex flex-col items-center gap-4 p-5 text-center">
                {/* Animated icon with pulsing rings */}
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/20 opacity-75" />
                  <span className="absolute inline-flex h-12 w-12 rounded-full bg-destructive/10" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                    <XCircle className="h-7 w-7 text-destructive" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground text-lg">
                    {t('entity.errorTitle')}
                  </h3>
                  <p className="text-muted-foreground text-sm">{t('entity.errorHint')}</p>
                </div>

                {/* Raw server error in a code-style block (often an entity set ID) */}
                <div className="flex w-full items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-left">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="wrap-break-word font-mono text-destructive text-xs leading-relaxed">
                    {entitiesError}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                  <Button size="xs" onClick={handleRetry}>
                    <RefreshCw />
                    {t('entity.tryAgain')}
                  </Button>
                  <Button variant="outline" size="xs" onClick={handleResetQuery}>
                    <RotateCcw />
                    {t('entity.resetQuery')}
                  </Button>
                  <Button variant="ghost" size="xs" onClick={handleCloseTab}>
                    <X />
                    {t('entity.closeTab')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : entities.length === 0 ? (
          <EmptyPanel
            icon={FileText}
            badgeIcon={Plus}
            badgeTone="primary"
            title={t('entity.noEntitiesFound')}
            description={t('entity.noEntitiesHint')}
            ghost="cards"
            size="lg"
            className="min-h-0 flex-1"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <EmptyPanelAction
                  icon={Plus}
                  onClick={() => handleCreateEntity()}
                  disabled={readonlyMode}
                >
                  {t('entity.createEntityButton')}
                </EmptyPanelAction>
                {selectedDataclass ? (
                  <AiActionsMenu dataclassName={selectedDataclass} variant="header" />
                ) : null}
              </div>
            }
          />
        ) : viewMode === 'table' ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <EntityDataGrid
              entities={entities}
              selectedEntityId={selectedEntityId}
              duplicateShortcut={
                duplicateEntityShortcut?.enabled
                  ? formatShortcut(duplicateEntityShortcut)
                  : undefined
              }
              deleteShortcut={
                deleteEntityShortcut?.enabled ? formatShortcut(deleteEntityShortcut) : undefined
              }
              readonlyMode={readonlyMode}
              selectedColumns={fieldConfig.table}
              columnWidths={columnWidths}
              onColumnWidthChange={handleColumnWidthChange}
              schema={schema}
              sortColumn={sortColumn}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              onSelect={handleSelectEntity}
              onCopyJson={handleCopyJson}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteEntity}
              onUpdate={updateEntity}
            />
          </div>
        ) : mobile ? (
          <PullToRefresh
            disabled={entitiesLoading}
            label={t('layout.pullToRefreshApp')}
            onRefresh={async () => {
              await refreshApp()
            }}
          >
            <div
              ref={listRef}
              className="space-y-3 p-4"
              role="listbox"
              aria-label={t('entity.entitiesInDataclass', { dataclass: selectedDataclass })}
              aria-activedescendant={selectedEntityId ? `entity-${selectedEntityId}` : undefined}
              tabIndex={0}
            >
              {entities.map((entity, index) => {
                const id = entity.id
                const isSelected = selectedEntityId === id
                const isFocused = focusedEntityIndex === index

                return (
                  <EntityCard
                    key={id}
                    entity={entity}
                    index={index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    readonlyMode={readonlyMode}
                    cardFields={fieldConfig.cards}
                    schema={schema}
                    isExpanded={expandedCardId === id}
                    onToggleExpand={() =>
                      setExpandedCardId((current) => (current === id ? null : id))
                    }
                    onSelect={handleSelectEntity}
                    onDuplicate={() => handleDuplicate(entity)}
                    onDelete={() => handleDeleteEntity(entity)}
                    cardRef={(el) => {
                      if (el) entityRefs.current.set(id, el)
                      else entityRefs.current.delete(id)
                    }}
                    duplicateShortcut={
                      duplicateEntityShortcut?.enabled
                        ? formatShortcut(duplicateEntityShortcut)
                        : undefined
                    }
                    deleteShortcut={
                      deleteEntityShortcut?.enabled
                        ? formatShortcut(deleteEntityShortcut)
                        : undefined
                    }
                  />
                )
              })}
            </div>
          </PullToRefresh>
        ) : (
          <ScrollArea className="min-h-0 flex-1" type="auto">
            <div
              ref={listRef}
              className="space-y-3 p-4"
              role="listbox"
              aria-label={t('entity.entitiesInDataclass', { dataclass: selectedDataclass })}
              aria-activedescendant={selectedEntityId ? `entity-${selectedEntityId}` : undefined}
              tabIndex={0}
            >
              {entities.map((entity, index) => {
                const id = entity.id
                const isSelected = selectedEntityId === id
                const isFocused = focusedEntityIndex === index

                return (
                  <EntityCard
                    key={id}
                    entity={entity}
                    index={index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    readonlyMode={readonlyMode}
                    cardFields={fieldConfig.cards}
                    schema={schema}
                    isExpanded={expandedCardId === id}
                    onToggleExpand={() =>
                      setExpandedCardId((current) => (current === id ? null : id))
                    }
                    onSelect={handleSelectEntity}
                    onDuplicate={() => handleDuplicate(entity)}
                    onDelete={() => handleDeleteEntity(entity)}
                    cardRef={(el) => {
                      if (el) entityRefs.current.set(id, el)
                      else entityRefs.current.delete(id)
                    }}
                    duplicateShortcut={
                      duplicateEntityShortcut?.enabled
                        ? formatShortcut(duplicateEntityShortcut)
                        : undefined
                    }
                    deleteShortcut={
                      deleteEntityShortcut?.enabled
                        ? formatShortcut(deleteEntityShortcut)
                        : undefined
                    }
                  />
                )
              })}
            </div>
          </ScrollArea>
        )}

        {pagination && (
          <div
            className={cn(
              'flex shrink-0 items-center border-t bg-muted/30',
              mobile ? 'h-12 justify-between gap-2 px-2' : 'h-9 gap-x-2 px-2'
            )}
          >
            <div className={cn('flex min-w-0 items-center', mobile ? 'gap-2' : 'gap-x-2')}>
              <p
                className={cn(
                  'min-w-0 truncate text-muted-foreground',
                  mobile ? 'max-w-[40%] text-xs' : 'text-xs'
                )}
              >
                <span className="font-medium text-foreground">
                  {pagination.total.toLocaleString()}
                </span>{' '}
                {pagination.total === 1 ? t('entity.result') : t('entity.results')}
                {dataclassTotalCount !== null && dataclassTotalCount !== pagination.total && (
                  <span className="text-muted-foreground/70">
                    {' '}
                    {t('entity.of')} {dataclassTotalCount.toLocaleString()}
                  </span>
                )}
              </p>
              {mobile ? (
                <QueryTopSelector
                  value={queryTop}
                  onChange={handleTopChange}
                  disabled={entitiesLoading}
                  className="shrink-0"
                />
              ) : null}
            </div>

            <div
              className={cn(
                'flex items-center',
                mobile
                  ? 'shrink-0 gap-0.5'
                  : '@[28rem]/entity-list:order-none order-last min-w-0 @[28rem]/entity-list:flex-1 justify-center gap-1.5'
              )}
            >
              {!mobile ? (
                <p className="shrink-0 text-muted-foreground text-xs">
                  {t('entity.pageOf', {
                    page: pagination.page,
                    total: pagination.totalPages,
                  })}
                </p>
              ) : null}
              <TooltipProvider>
                <div className="flex shrink-0 items-center gap-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-6 w-6', mobile && 'h-10 w-10')}
                        onClick={() => fetchEntities(1)}
                        disabled={pagination.page === 1 || entitiesLoading}
                        aria-label={t('command.firstPage')}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('command.firstPage')}
                      {pageFirstShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(pageFirstShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-6 w-6', mobile && 'h-10 w-10')}
                        onClick={() => fetchEntities(pagination.page - 1)}
                        disabled={!pagination.hasPrev || entitiesLoading}
                        aria-label={t('command.previousPage')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('command.previousPage')}
                      {pagePrevShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(pagePrevShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  {mobile ? (
                    <span className="min-w-10 px-1 text-center font-medium text-muted-foreground text-xs tabular-nums">
                      {pagination.page}/{pagination.totalPages}
                    </span>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-6 w-6', mobile && 'h-10 w-10')}
                        onClick={() => fetchEntities(pagination.page + 1)}
                        disabled={!pagination.hasNext || entitiesLoading}
                        aria-label={t('command.nextPage')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('command.nextPage')}
                      {pageNextShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(pageNextShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-6 w-6', mobile && 'h-10 w-10')}
                        onClick={() => fetchEntities(pagination.totalPages)}
                        disabled={pagination.page === pagination.totalPages || entitiesLoading}
                        aria-label={t('command.lastPage')}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('command.lastPage')}
                      {pageLastShortcut?.enabled && (
                        <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                          {formatShortcut(pageLastShortcut)}
                        </kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {!mobile ? (
              <QueryTopSelector
                value={queryTop}
                onChange={handleTopChange}
                disabled={entitiesLoading}
                className="ml-auto shrink-0"
              />
            ) : null}
          </div>
        )}

        <CreateEntityDialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false)
            setDuplicateData(undefined)
          }}
          dataclassName={selectedDataclass}
          initialData={duplicateData}
          isDuplicate={!!duplicateData}
          onSubmit={async (data) => {
            await createEntity(data)
            toast.success(t('entity.entityCreated'))
          }}
        />
        <ConfirmDialog />
      </div>
    </SwipeNavigate>
  )
}
