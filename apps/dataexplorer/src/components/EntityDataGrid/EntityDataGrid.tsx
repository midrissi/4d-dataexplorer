import { cn } from '@4d/ui'
import {
  AllCommunityModule,
  type CellEditingStoppedEvent,
  type ColDef,
  type ColumnResizedEvent,
  type GetRowIdParams,
  type GridReadyEvent,
  type IRowNode,
  ModuleRegistry,
  type RowClassParams,
  type RowClickedEvent,
  type SortChangedEvent,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { getIntlLocale, useTranslation } from '~/i18n'
import {
  detectFieldType,
  isRelationshipType,
  mapCatalogTypeToFieldType,
  objectValueFormatter,
  objectValueParser,
} from '~/lib/entity-datagrid/field-types'
import { DEFERRED_RELATION_MARKER, getByPath } from '~/lib/fieldPaths'
import type { Entity } from '~/store'
import { ActionsCellRenderer } from './ActionsCellRenderer'
import { BooleanCellRenderer } from './BooleanCellRenderer'
import { DateCellRenderer } from './DateCellRenderer'
import { DurationCellRenderer } from './DurationCellRenderer'
import { customTheme, gridStyles } from './grid-theme'
import { ImageCellRenderer } from './ImageCellRenderer'
import { NumberCellRenderer } from './NumberCellRenderer'
import { ObjectCellRenderer } from './ObjectCellRenderer'
import { TextCellRenderer } from './TextCellRenderer'
import type { EntityDataGridProps } from './types'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

// Temporarily disable in-table editing in list view (re-enable by setting to true)
const GRID_EDITING_ENABLED = false

export function EntityDataGrid({
  entities,
  selectedEntityId = null,
  readonlyMode = false,
  selectedColumns = [],
  columnWidths,
  onColumnWidthChange,
  schema,
  onSelectedColumnsChange: _onSelectedColumnsChange,
  sortColumn = null,
  sortOrder = 'asc',
  onSortChange,
  onSelect,
  onCopyJson,
  onDuplicate,
  onDelete,
  duplicateShortcut,
  deleteShortcut,
  onUpdate,
  showActions,
  autoHeight = false,
  className,
}: EntityDataGridProps) {
  const { language } = useTranslation()
  const gridRef = useRef<AgGridReact>(null)
  const gridContext = useMemo(() => ({ locale: getIntlLocale(language) }), [language])

  // Show the actions column unless explicitly disabled. Defaults to true when at
  // least one action callback is supplied (keeps the main table view unchanged).
  const actionsEnabled = showActions ?? Boolean(onCopyJson || onDuplicate || onDelete)

  // Get all unique columns from entities
  const allColumns = useMemo(() => {
    if (entities.length === 0) return []
    const allKeys = new Set<string>()
    for (const entity of entities) {
      for (const key of Object.keys(entity)) {
        if (key !== 'id') {
          allKeys.add(key)
        }
      }
    }
    return Array.from(allKeys)
  }, [entities])

  // Get column types from schema (catalog) or fallback to entity detection
  const columnTypes = useMemo(() => {
    const types: Record<string, ReturnType<typeof detectFieldType>> = {}

    if (schema && schema.length > 0) {
      // Use schema from catalog
      for (const attr of schema) {
        types[attr.name] = mapCatalogTypeToFieldType(attr.type, attr.kind)
      }
    }

    // Fallback: detect types from entities for columns not in schema
    for (const entity of entities) {
      for (const [key, value] of Object.entries(entity)) {
        if (!types[key] && value !== null && value !== undefined) {
          types[key] = detectFieldType(value)
        }
      }
    }

    return types
  }, [entities, schema])

  // Manually-resized column widths, keyed by colId. Baked into columnDefs on
  // every rebuild so widths survive page navigation. Reset when the explicit
  // column selection (Field Manager) changes.
  const colWidthsRef = useRef<Record<string, number>>({})
  const prevSelectionKeyRef = useRef<string>('\u0000__init__')

  // Build column definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = []

    // When the user has explicitly chosen columns (possibly nested relation
    // paths like "company.name"), render exactly those in the chosen order.
    // Otherwise fall back to every flat attribute discovered on the entities.
    const useExplicitColumns = selectedColumns.length > 0
    const orderedColumns = useExplicitColumns ? selectedColumns : allColumns

    // Discard remembered widths when the explicit selection changes (columns
    // added/removed/reordered via the Field Manager). Page navigation keeps the
    // same selection, so widths are retained across pages. Done synchronously
    // here so the rebuilt defs below already reflect the reset.
    const selectionKey = selectedColumns.join('\u0000')
    if (selectionKey !== prevSelectionKeyRef.current) {
      colWidthsRef.current = {}
      prevSelectionKeyRef.current = selectionKey
    }

    // Detect a column type for a (possibly nested) path. Flat columns use the
    // catalog/entity-derived types; nested paths sample the resolved values.
    const getPathType = (path: string): ReturnType<typeof detectFieldType> => {
      if (!path.includes('.')) return columnTypes[path] || 'text'
      for (const entity of entities) {
        const v = getByPath(entity, path)
        if (v !== null && v !== undefined && v !== DEFERRED_RELATION_MARKER) {
          return detectFieldType(v)
        }
      }
      return 'text'
    }

    // Add dynamic columns based on entity fields
    for (const col of orderedColumns) {
      const isDotted = col.includes('.')

      if (!isDotted && (col === '__KEY' || col === '__STAMP' || col === '__TIMESTAMP')) continue

      const colType = getPathType(col)

      // Skip relationship object roots (relatedEntity, relatedEntities); nested
      // paths always resolve to a leaf scalar so they are kept.
      if (!isDotted && isRelationshipType(col, schema, entities)) continue

      const colDef: ColDef = {
        field: isDotted ? undefined : col,
        colId: col,
        headerName: col,
        hide: false,
        filter: false,
        floatingFilter: false,
        editable: GRID_EDITING_ENABLED && !isDotted && !readonlyMode && colType !== 'object',
        minWidth: 100,
        flex: 1,
        resizable: true,
        ...(isDotted
          ? {
              valueGetter: (params) => {
                if (!params.data) return undefined
                const v = getByPath(params.data, col)
                return v === DEFERRED_RELATION_MARKER ? null : v
              },
            }
          : {}),
        // Default formatter/parser so AG Grid never infers "object" without them (avoids warning #48)
        valueFormatter: (params) => {
          const value = params.value
          if (value === null || value === undefined) return ''
          if (typeof value === 'object') return objectValueFormatter(params)
          return String(value)
        },
        valueParser: (params) => {
          const s = params.newValue
          if (s === null || s === '') return null
          try {
            const parsed = JSON.parse(s) as unknown
            if (typeof parsed === 'object' && parsed !== null) return parsed
            return s
          } catch {
            return s
          }
        },
      }

      // Configure based on type
      switch (colType) {
        case 'boolean':
          colDef.cellEditor = 'agCheckboxCellEditor'
          colDef.cellRenderer = BooleanCellRenderer
          colDef.flex = 0.5
          colDef.minWidth = 80
          break

        case 'number':
          colDef.cellEditor = 'agNumberCellEditor'
          colDef.cellRenderer = NumberCellRenderer
          colDef.flex = 0.8
          colDef.minWidth = 100
          break

        case 'duration':
          colDef.cellEditor = 'agNumberCellEditor'
          colDef.cellRenderer = DurationCellRenderer
          colDef.flex = 0.8
          colDef.minWidth = 100
          break

        case 'date':
          colDef.cellEditor = 'agDateStringCellEditor'
          colDef.cellRenderer = DateCellRenderer
          colDef.flex = 1.2
          colDef.minWidth = 150
          break

        case 'image':
          colDef.cellRenderer = ImageCellRenderer
          colDef.editable = false
          colDef.filter = false
          colDef.flex = 1
          colDef.minWidth = 150
          colDef.cellClass = 'ag-cell-image'
          break

        case 'object':
          colDef.cellRenderer = ObjectCellRenderer
          colDef.valueFormatter = objectValueFormatter
          colDef.valueParser = objectValueParser
          colDef.editable = false
          break

        default:
          colDef.cellEditor = 'agTextCellEditor'
          colDef.cellRenderer = TextCellRenderer
      }

      // Apply a remembered manual width: pin it, drop flex, and exclude it from
      // size-to-fit so the column keeps the user's size across page navigation
      // while the remaining columns still fill the viewport. Falls back to the
      // persisted preset width (columnWidths) for the initial render.
      const savedWidth = colWidthsRef.current[col] ?? columnWidths?.[col]
      if (savedWidth != null) {
        colDef.width = savedWidth
        colDef.flex = undefined
        colDef.suppressSizeToFit = true
      }

      // Server-side single-column sort: clicking the header asks the parent to
      // refetch ordered by this attribute. Only flat scalar columns are
      // sortable (relations, nested paths, objects and images are excluded).
      const sortable =
        onSortChange != null && !isDotted && colType !== 'object' && colType !== 'image'
      colDef.sortable = sortable
      if (sortable) {
        colDef.sort = col === sortColumn ? sortOrder : null
      }

      cols.push(colDef)
    }

    // Actions column (pinned right)
    if (actionsEnabled) {
      cols.push({
        colId: '__actions',
        headerName: '',
        width: 120,
        minWidth: 120,
        maxWidth: 120,
        pinned: 'right',
        editable: false,
        filter: false,
        sortable: false,
        resizable: false,
        suppressSizeToFit: true,
        flex: 0,
        cellClass: 'ag-cell-actions',
        cellRenderer: ActionsCellRenderer,
        cellRendererParams: {
          readonlyMode,
          onCopyJson,
          onDuplicate,
          onDelete,
          duplicateShortcut,
          deleteShortcut,
        },
      })
    }

    return cols
  }, [
    allColumns,
    columnTypes,
    selectedColumns,
    columnWidths,
    readonlyMode,
    actionsEnabled,
    onCopyJson,
    onDuplicate,
    onDelete,
    duplicateShortcut,
    deleteShortcut,
    schema,
    entities,
    sortColumn,
    sortOrder,
    onSortChange,
  ])

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    if (params.api.isDestroyed?.()) return
    // Size columns to fit available space
    params.api.sizeColumnsToFit()
  }, [])

  // Server-side sort: translate a header click into a refetch request. Reads the
  // resulting AG Grid sort state and forwards the sorted column/direction to the
  // parent. Guards against the programmatic re-application (after refetch) that
  // would otherwise loop.
  const onSortChanged = useCallback(
    (event: SortChangedEvent) => {
      if (!onSortChange) return
      const sorted = event.api.getColumnState().find((s) => s.sort === 'asc' || s.sort === 'desc')
      if (sorted?.colId) {
        const order = sorted.sort as 'asc' | 'desc'
        if (sorted.colId !== sortColumn || order !== sortOrder) {
          onSortChange(sorted.colId, order)
        }
      } else if (sortColumn) {
        onSortChange(null, sortOrder)
      }
    },
    [onSortChange, sortColumn, sortOrder]
  )

  // Preserve user-adjusted column widths across page navigation. Navigating
  // pages rebuilds rowData/columnDefs, which would otherwise reset widths back
  // to their flex defaults. We snapshot the column state on manual resize and
  // re-apply it whenever the same column set is re-rendered.
  // Preserve user-adjusted column widths across page navigation. Navigating
  // pages rebuilds rowData/columnDefs, which would otherwise reset widths back
  // to their flex defaults. We remember each manually-resized column width by
  // colId (see colWidthsRef above) and bake it straight into the column
  // definitions on every rebuild, so ag-grid renders the chosen width natively
  // (no post-render reflow/race).
  const onColumnResized = useCallback(
    (event: ColumnResizedEvent) => {
      // Only persist when the user finished a manual drag-resize (ignore
      // programmatic sizeColumnsToFit/autosize/flex events).
      if (event.finished && event.source === 'uiColumnResized') {
        const resized = event.columns ?? (event.column ? [event.column] : [])
        for (const column of resized) {
          const colId = column.getColId()
          const width = column.getActualWidth()
          colWidthsRef.current[colId] = width
          if (colId !== '__actions') {
            onColumnWidthChange?.(colId, width)
          }
        }
      }
    },
    [onColumnWidthChange]
  )

  // Handle first data rendered - resize columns after data loads
  const onFirstDataRendered = useCallback(
    (params: { api: { sizeColumnsToFit: () => void; isDestroyed?: () => boolean } }) => {
      if (params.api.isDestroyed?.()) return
      params.api.sizeColumnsToFit()
    },
    []
  )

  // Handle row selection
  const onRowClicked = useCallback(
    (event: RowClickedEvent<Entity>) => {
      if (onSelect && event.data && event.rowIndex !== null && event.rowIndex !== undefined) {
        onSelect(event.data, event.rowIndex)
      }
    },
    [onSelect]
  )

  // Handle cell editing
  const onCellEditingStopped = useCallback(
    async (event: CellEditingStoppedEvent) => {
      if (onUpdate && event.valueChanged && event.data) {
        const entity = event.data as Entity
        const field = event.colDef.field
        if (field && field !== '__KEY' && field !== '__STAMP') {
          const updatedData = { [field]: event.newValue }
          try {
            await onUpdate(entity.id, updatedData)
          } catch (error) {
            // Revert on error - refresh the grid
            if (event.node) {
              gridRef.current?.api.refreshCells({ rowNodes: [event.node] })
            }
            console.error('Failed to update entity:', error)
          }
        }
      }
    },
    [onUpdate]
  )

  // Get row ID. Related entity sets expose `__KEY` instead of `id`, so fall back
  // to it to keep row identity stable across renders.
  const getRowId = useCallback(
    (params: GetRowIdParams<Entity>) => String(params.data.id ?? params.data.__KEY),
    []
  )

  // Selection class via rowClassRules (not getRowClass): AG Grid does not remove
  // classes previously applied by getRowClass when the callback later returns
  // undefined, which left pinned-right actions highlighted after reselection.
  const rowClassRules = useMemo(
    () => ({
      'ag-row-selected-custom': (params: RowClassParams<Entity>) => {
        if (!selectedEntityId || !params.data) return false
        return String(params.data.id ?? params.data.__KEY) === selectedEntityId
      },
    }),
    [selectedEntityId]
  )

  // Clear sticky inline backgrounds on non-selected rows. Selection color itself
  // comes from CSS on `.ag-row-selected-custom` so center + pinned actions stay in sync.
  const getRowStyle = useCallback(
    (params: { data: Entity | undefined }) => {
      const rowId = params.data != null ? String(params.data.id ?? params.data.__KEY) : null
      if (rowId != null && rowId === selectedEntityId) {
        return undefined
      }
      return {
        backgroundColor: '',
        color: '',
      }
    },
    [selectedEntityId]
  )

  // Track previous selected entity to refresh only changed rows
  const prevSelectedEntityIdRef = useRef<string | null>(null)
  const prevEntitiesRef = useRef(entities)

  // Refresh affected rows when selection or row data changes (pinned actions
  // can keep a stale selection highlight after catalog/entity refresh).
  // useLayoutEffect so class + style apply before paint — avoids actions
  // flashing selected ahead of the rest of the row.
  useLayoutEffect(() => {
    const api = gridRef.current?.api
    if (!api || api.isDestroyed?.()) return

    const entitiesChanged = prevEntitiesRef.current !== entities
    prevEntitiesRef.current = entities

    const rowNodesToRefresh: IRowNode[] = []
    const seen = new Set<IRowNode>()
    const addNode = (id: string | null | undefined) => {
      if (!id) return
      const node = api.getRowNode(id)
      if (node && !seen.has(node)) {
        seen.add(node)
        rowNodesToRefresh.push(node)
      }
    }

    addNode(prevSelectedEntityIdRef.current)
    addNode(selectedEntityId)

    if (api.isDestroyed?.()) return

    if (entitiesChanged) {
      // Full redraw clears sticky pinned-right styles after rowData replacement.
      api.redrawRows()
    } else if (rowNodesToRefresh.length > 0) {
      api.redrawRows({ rowNodes: rowNodesToRefresh })
    }

    // Keep the selected row in view (mirrors cards `scrollIntoView` on focus change).
    const selectionChanged = prevSelectedEntityIdRef.current !== selectedEntityId
    let scrollTimeout: ReturnType<typeof setTimeout> | undefined
    if (selectedEntityId && (selectionChanged || entitiesChanged)) {
      const scrollToSelection = () => {
        const live = gridRef.current?.api
        if (!live || live.isDestroyed?.()) return
        const node = live.getRowNode(selectedEntityId)
        if (node) live.ensureNodeVisible(node)
      }
      scrollToSelection()
      // After page/data replacement, row nodes may not exist until AG Grid applies rowData.
      if (entitiesChanged) {
        scrollTimeout = setTimeout(scrollToSelection, 0)
      }
    }

    prevSelectedEntityIdRef.current = selectedEntityId
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [selectedEntityId, entities])

  // After the column definitions change (page navigation, field selection,
  // schema load), fit columns to the viewport. Columns the user manually
  // resized carry suppressSizeToFit + an explicit width, so they keep their
  // size while the remaining columns expand to fill the available space.
  // Note: requestAnimationFrame callbacks do not fire reliably on this view, so
  // a short timeout is used to re-fit once ag-grid has applied the new columns.
  useEffect(() => {
    const api = gridRef.current?.api
    if (!api || api.isDestroyed?.() || columnDefs.length === 0) return
    api.sizeColumnsToFit()
    const t = setTimeout(() => {
      const live = gridRef.current?.api
      if (!live || live.isDestroyed?.()) return
      live.sizeColumnsToFit()
    }, 60)
    return () => clearTimeout(t)
  }, [columnDefs])

  return (
    <div className={cn('flex flex-col', autoHeight ? '' : 'h-full', className)}>
      {/* Grid */}
      <style>{gridStyles}</style>
      <div className={autoHeight ? '' : 'flex-1'}>
        <AgGridReact
          ref={gridRef}
          theme={customTheme}
          context={gridContext}
          rowData={entities}
          columnDefs={columnDefs}
          getRowId={getRowId}
          rowClassRules={rowClassRules}
          getRowStyle={getRowStyle}
          popupParent={document.body}
          domLayout={autoHeight ? 'autoHeight' : undefined}
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onRowClicked={onRowClicked}
          onCellEditingStopped={onCellEditingStopped}
          onColumnResized={onColumnResized}
          onSortChanged={onSortChanged}
          sortingOrder={['asc', 'desc']}
          animateRows={false}
          enableCellTextSelection={true}
          stopEditingWhenCellsLoseFocus={true}
          suppressColumnVirtualisation={true}
          suppressCellFocus={true}
          defaultColDef={{
            resizable: true,
            sortable: false,
            // Sorting is server-side; never let AG Grid reorder the current page
            // locally (it would produce an order inconsistent with the server).
            comparator: () => 0,
          }}
        />
      </div>
    </div>
  )
}
