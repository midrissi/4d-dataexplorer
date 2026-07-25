import { EMPTY_VALUE, formatDate, formatDuration, formatNumber } from '@4d/rest'
import {
  Button,
  ClickToCopy,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Value,
} from '@4d/ui'
import {
  AllCommunityModule,
  type CellEditingStoppedEvent,
  type ColDef,
  type ColumnResizedEvent,
  type GetRowIdParams,
  type GridReadyEvent,
  type ICellRendererParams,
  type IRowNode,
  ModuleRegistry,
  type RowClassParams,
  type RowClickedEvent,
  type SortChangedEvent,
  themeQuartz,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { Copy, Hash, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ObjectTree } from '~/components/Console/ObjectTree'
import { DeferredImage } from '~/components/DeferredImage'
import { getIntlLocale, useTranslation } from '~/i18n'
import { DEFERRED_RELATION_MARKER, getByPath, getImageUri } from '~/lib/fieldPaths'
import type { Entity } from '~/store'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

// Custom theme based on Quartz with design system colors.
// Theme CSS variables are full colors (oklch/hsl/#hex), not channel triplets —
// so use var(--token), never hsl(var(--token)).
const customTheme = themeQuartz.withParams({
  backgroundColor: 'var(--background)',
  foregroundColor: 'var(--foreground)',
  headerBackgroundColor: 'var(--muted)',
  headerTextColor: 'var(--foreground)',
  oddRowBackgroundColor: 'var(--background)',
  rowHoverColor: 'color-mix(in oklch, var(--accent) 40%, transparent)',
  selectedRowBackgroundColor: 'color-mix(in oklch, var(--primary) 22%, var(--background))',
  borderColor: 'color-mix(in oklch, var(--border) 70%, transparent)',
  chromeBackgroundColor: 'var(--muted)',
  accentColor: 'var(--primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  headerFontSize: 11,
  rowHeight: 28,
  headerHeight: 28,
  cellHorizontalPadding: 8,
  wrapperBorderRadius: 0,
  popupShadow: 'var(--shadow-md)',
  spacing: 4,
})

// CSS fixes for AG Grid popups/filters
const gridStyles = `
  /* All popups need highest z-index and solid background */
  .ag-popup {
    z-index: 9999 !important;
  }
  
  /* Popup container - must have solid background */
  .ag-popup-child {
    background: var(--popover) !important;
    background-color: var(--popover) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: var(--shadow-md) !important;
    z-index: 9999 !important;
  }
  
  /* Select list dropdown - solid background */
  .ag-select-list {
    background: var(--popover) !important;
    background-color: var(--popover) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: var(--shadow-md) !important;
  }
  
  /* List items in dropdown */
  .ag-list-item {
    background: var(--popover) !important;
    color: var(--popover-foreground) !important;
    padding: 4px 8px !important;
    font-size: var(--text-xs) !important;
  }
  
  .ag-list-item:hover {
    background: var(--accent) !important;
  }
  
  .ag-list-item.ag-active-item {
    background: var(--accent) !important;
  }

  /* Rows are selectable — show pointer affordance */
  .ag-row {
    cursor: pointer;
  }
  
  /* Filter panel */
  .ag-filter {
    background: var(--popover) !important;
    background-color: var(--popover) !important;
    color: var(--popover-foreground) !important;
  }
  
  .ag-filter-body-wrapper {
    padding: 8px;
    background: var(--popover) !important;
  }
  
  /* Filter inputs */
  .ag-filter input,
  .ag-text-field-input {
    background: var(--input) !important;
    background-color: var(--input) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px !important;
    color: var(--foreground) !important;
    padding: 6px 8px;
  }
  
  .ag-filter input:focus,
  .ag-text-field-input:focus {
    outline: none !important;
    border-color: var(--primary) !important;
  }
  
  /* Select/picker elements */
  .ag-select,
  .ag-picker-field-wrapper {
    background: var(--input) !important;
    background-color: var(--input) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px !important;
    color: var(--foreground) !important;
  }
  
  /* Picker field display */
  .ag-picker-field-display {
    color: var(--foreground) !important;
  }
  
  /* Picker icon */
  .ag-picker-field-icon {
    color: var(--foreground) !important;
  }
  
  /* Fix filter icon positioning in floating filter inputs */
  .ag-floating-filter-input-wrapper {
    position: relative !important;
  }
  
  .ag-floating-filter-input-wrapper .ag-input-wrapper {
    position: relative !important;
  }
  
  .ag-floating-filter-input-wrapper .ag-input-wrapper::before {
    position: absolute !important;
    left: 8px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    z-index: 1 !important;
    pointer-events: none !important;
  }
  
  .ag-floating-filter-input-wrapper .ag-input-field-input,
  .ag-floating-filter-input-wrapper input {
    padding-left: 28px !important;
  }
  
  /* Ensure image cells are vertically centered */
  .ag-cell-image {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  /* Ensure actions cell is vertically centered */
  .ag-cell-actions {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /*
   * Pinned-right actions are sticky over horizontally scrolled cells (AG Grid
   * uses .ag-grid-pinned-right-cells, not the older .ag-pinned-right-cols-*).
   * Theme tokens are full colors, so use var(--token). Clip scrolling cells and
   * keep pinned cells opaque so description text cannot paint over the icons.
   */
  .ag-grid-scrolling-cells {
    overflow: hidden !important;
    z-index: 0 !important;
  }

  .ag-grid-scrolling-cells .ag-cell {
    overflow: hidden !important;
  }

  .ag-grid-pinned-right-cells {
    background-color: var(--background) !important;
    overflow: hidden !important;
    z-index: 2 !important;
  }

  /* Hover only when not selected — selection styling must stay uniform */
  .ag-row-hover:not(.ag-row-selected-custom) .ag-grid-pinned-right-cells {
    background-color: var(--muted) !important;
  }

  .ag-cell-first-right-pinned,
  .ag-cell-actions {
    background-color: var(--background) !important;
  }

  .ag-row-hover:not(.ag-row-selected-custom) .ag-cell-first-right-pinned,
  .ag-row-hover:not(.ag-row-selected-custom) .ag-cell-actions {
    background-color: var(--muted) !important;
  }

  /* Suppress AG Grid's hover overlay on the selected row */
  .ag-row-selected-custom.ag-row-hover {
    --ag-internal-row-overlay-color: transparent;
  }

  /* Keep the empty actions header flush with the rest of the header row */
  .ag-header,
  .ag-header-row,
  .ag-header-cell,
  .ag-header-cell-first-right-pinned {
    background-color: var(--muted) !important;
  }

  .ag-header-cell-first-right-pinned {
    border: none !important;
    box-shadow: none !important;
  }

  .ag-header-row .ag-grid-pinned-right-cells,
  .ag-header-row .ag-grid-pinned-right-cells .ag-grid-container-wrapper {
    background-color: var(--muted) !important;
    box-shadow: none !important;
    border: none !important;
    border-left: none !important;
  }

  /*
   * Selected highlight is CSS-only so center cells and pinned-right actions
   * paint in the same frame when ag-row-selected-custom is toggled. Avoid
   * transparent center cells + delayed getRowStyle (actions looked ahead).
   */
  .ag-row-selected-custom {
    background-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
  }

  .ag-row-selected-custom .ag-cell,
  .ag-row-selected-custom .ag-grid-pinned-right-cells,
  .ag-row-selected-custom .ag-cell-first-right-pinned,
  .ag-row-selected-custom .ag-cell-actions {
    background-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
    border-right: none !important;
  }

  /*
   * Type-tinted values (amber numbers, emerald dates, etc.) fail WCAG on the
   * primary selection background — force readable foreground everywhere.
   */
  .ag-row-selected-custom .ag-cell,
  .ag-row-selected-custom .ag-cell *:not(svg) {
    color: var(--primary-foreground) !important;
  }

  .ag-row-selected-custom .ag-cell svg {
    color: var(--primary-foreground) !important;
    stroke: var(--primary-foreground) !important;
  }

  .ag-row-selected-custom .ag-cell a {
    color: var(--primary-foreground) !important;
    text-decoration-color: color-mix(in oklch, var(--primary-foreground) 55%, transparent);
  }

  /* Soften chips/pills so they don't fight the selection fill */
  .ag-row-selected-custom .ag-cell [class*='rounded-full'],
  .ag-row-selected-custom .ag-cell [class*='bg-muted'],
  .ag-row-selected-custom .ag-cell [class*='bg-primary'],
  .ag-row-selected-custom .ag-cell [class*='bg-black'] {
    background-color: color-mix(in oklch, var(--primary-foreground) 16%, transparent) !important;
    border-color: color-mix(in oklch, var(--primary-foreground) 30%, transparent) !important;
    color: var(--primary-foreground) !important;
    opacity: 1 !important;
  }

  .ag-row-selected-custom .ag-cell button {
    color: var(--primary-foreground) !important;
  }

  .ag-row-selected-custom .ag-cell button:hover {
    background-color: color-mix(in oklch, var(--primary-foreground) 14%, transparent) !important;
  }
`

type AttributeSchema = {
  name: string
  type: string
  kind?: string
  behavior?: string
  indexed?: boolean
  unique?: boolean
  readOnly?: boolean
}

// Temporarily disable in-table editing in list view (re-enable by setting to true)
const GRID_EDITING_ENABLED = false

type EntityDataGridProps = {
  entities: Entity[]
  selectedEntityId?: string | null
  readonlyMode?: boolean
  selectedColumns?: string[] // Empty means all columns visible
  /** Persisted per-column widths (keyed by colId) restored on render. */
  columnWidths?: Record<string, number>
  /** Called when the user finishes a manual column resize. */
  onColumnWidthChange?: (columnName: string, width: number) => void
  schema?: AttributeSchema[] // Schema from catalog
  onSelectedColumnsChange?: (columns: string[]) => void
  /** Attribute the grid is currently sorted by (server-side), if any. */
  sortColumn?: string | null
  /** Sort direction for {@link sortColumn}. */
  sortOrder?: 'asc' | 'desc'
  /**
   * Called when the user clicks a column header to sort. Pass to enable
   * server-side single-column sorting; omit to disable header sorting entirely
   * (e.g. embedded read-only related-entity tables).
   */
  onSortChange?: (column: string | null, order: 'asc' | 'desc') => void
  onSelect?: (entity: Entity, index: number) => void
  onCopyJson?: (entity: Entity) => void
  onDuplicate?: (entity: Entity) => void
  onDelete?: (entity: Entity) => void
  duplicateShortcut?: string
  deleteShortcut?: string
  onUpdate?: (id: string, data: Record<string, unknown>) => Promise<void>
  /**
   * Whether to render the actions column (copy/duplicate/delete). Defaults to
   * true when any action callback is provided. Set false to embed the grid as a
   * plain read-only table (e.g. related entity sets in the entity viewer).
   */
  showActions?: boolean
  /**
   * Use AG Grid auto-height layout so the grid grows to fit its rows instead of
   * filling its parent. Useful when embedding the grid inline.
   */
  autoHeight?: boolean
  /** Extra class names for the grid wrapper. */
  className?: string
}

// Actions cell renderer component
function ActionsCellRenderer(
  props: ICellRendererParams & {
    readonlyMode: boolean
    onCopyJson: (entity: Entity) => void
    onDuplicate: (entity: Entity) => void
    onDelete: (entity: Entity) => void
    duplicateShortcut?: string
    deleteShortcut?: string
  }
) {
  const { t } = useTranslation()
  const entity = props.data as Entity
  if (!entity) return null

  return (
    <div className="relative z-1 flex h-full w-full items-center justify-center gap-1">
      <ClickToCopy
        value={JSON.stringify(entity, null, 2)}
        tooltipLabel={t('entity.copyJson')}
        tooltipCopiedLabel={t('common.copied')}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
      >
        <Copy className="h-4 w-4" />
      </ClickToCopy>
      {!props.readonlyMode && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => props.onDuplicate(entity)}
            title={
              props.duplicateShortcut
                ? `${t('entity.duplicate')} (${props.duplicateShortcut})`
                : t('entity.duplicate')
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => props.onDelete(entity)}
            title={
              props.deleteShortcut
                ? `${t('entity.delete')} (${props.deleteShortcut})`
                : t('entity.delete')
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

// Boolean cell renderer
function BooleanCellRenderer(props: ICellRendererParams) {
  if (props.value === null || props.value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={props.value} isObject={false}>
      <Value.Boolean value={props.value} format="truefalse" />
    </CellTooltipWrapper>
  )
}

// Cell preview: tooltips for truncated/formatted primitives; hover popover for
// interactive object trees (scroll / binary viewer must not dismiss on wheel).
function CellTooltipWrapper({
  children,
  value,
  isObject,
  formatted,
}: {
  children: React.ReactNode
  value: unknown
  isObject: boolean
  formatted?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [objectOpen, setObjectOpen] = useState(false)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openObjectPreview = useCallback(() => {
    clearCloseTimer()
    setObjectOpen(true)
  }, [clearCloseTimer])

  const scheduleCloseObjectPreview = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setObjectOpen(false)
      closeTimerRef.current = null
    }, 200)
  }, [clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  // Detect actual visual truncation (content wider/taller than the cell).
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (value === null || value === undefined) {
    return <>{children}</>
  }

  const rawString = String(value)
  // Only treat as "dual" when a distinct human-readable formatting exists.
  const hasFormatted = formatted != null && formatted !== '' && formatted !== rawString

  if (isObject) {
    return (
      <Popover open={objectOpen} onOpenChange={setObjectOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full cursor-help overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left font-[inherit] text-inherit"
            onMouseEnter={openObjectPreview}
            onMouseLeave={scheduleCloseObjectPreview}
            onFocus={openObjectPreview}
            onBlur={scheduleCloseObjectPreview}
            onClick={(e) => {
              // Toggle pin; stop row selection from stealing the interaction.
              e.stopPropagation()
              clearCloseTimer()
              setObjectOpen((open) => !open)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-h-[min(28rem,70vh)] w-[min(36rem,90vw)] max-w-[min(36rem,90vw)] overflow-hidden p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={openObjectPreview}
          onMouseLeave={scheduleCloseObjectPreview}
          onWheel={(e) => e.stopPropagation()}
          onInteractOutside={(e) => {
            // Keep open while interacting inside; only outside pointer closes immediately.
            const target = e.target
            if (
              target instanceof Element &&
              target.closest('[data-radix-popper-content-wrapper]')
            ) {
              e.preventDefault()
            }
          }}
        >
          <div
            className="max-h-[min(28rem,70vh)] overflow-auto p-2 font-mono text-xs"
            onWheel={(e) => e.stopPropagation()}
          >
            <ObjectTree value={value} defaultOpen />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Primitives only when truncated or reformatted.
  const shouldShowTooltip = isTruncated || hasFormatted

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={contentRef}
            className={cn(
              'w-full overflow-hidden text-ellipsis whitespace-nowrap',
              shouldShowTooltip && 'cursor-help'
            )}
          >
            {children}
          </div>
        </TooltipTrigger>
        {shouldShowTooltip ? (
          <TooltipContent side="right" className="max-w-lg overflow-hidden p-0">
            {hasFormatted ? (
              <div className="divide-y divide-border">
                <div className="px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Formatted
                  </div>
                  <pre className="wrap-break-word whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
                    {formatted}
                  </pre>
                </div>
                <div className="bg-muted/40 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Hash className="h-3 w-3" />
                    Raw
                  </div>
                  <pre className="wrap-break-word whitespace-pre-wrap font-mono text-muted-foreground text-xs leading-relaxed">
                    {rawString}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-sm bg-muted/50 p-2">
                <pre className="wrap-break-word whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
                  {rawString}
                </pre>
              </div>
            )}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  )
}

// Value formatter for object type (required by AG Grid when data type is object)
function objectValueFormatter(params: { value: unknown }): string {
  const value = params.value
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  try {
    const str = JSON.stringify(value)
    return str.length > 80 ? `${str.slice(0, 80)}…` : str
  } catch {
    return '[Object]'
  }
}

// Value parser for object type (required by AG Grid when data type is object)
function objectValueParser(params: { newValue: string | null }): unknown {
  const str = params.newValue
  if (str === null || str === undefined || str === '') return null
  try {
    return JSON.parse(str) as unknown
  } catch {
    return null
  }
}

// Object cell renderer
function ObjectCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={true}>
      <Value.Object value={value as unknown[] | Record<string, unknown>} />
    </CellTooltipWrapper>
  )
}

// Image cell renderer
function ImageCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }

  if (!getImageUri(value)) {
    return <Value.Null />
  }

  const fieldName = typeof props.colDef?.field === 'string' ? props.colDef.field : 'Image'

  return (
    <div className="flex h-full items-center justify-center">
      <DeferredImage value={value} alt={fieldName} className="h-8 w-8 rounded-full object-cover" />
    </div>
  )
}

// Detect field type from value
function detectFieldType(
  value: unknown
): 'text' | 'number' | 'boolean' | 'date' | 'duration' | 'object' | 'image' | 'null' {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (getImageUri(value)) return 'image'
  if (typeof value === 'number') {
    // Check if it's a duration (milliseconds) - numbers that represent time
    // Durations are usually >= 1000ms (at least 1 second) and represent reasonable time ranges
    // Check if it's divisible by 1000 (whole seconds) and within a reasonable range
    // Max reasonable duration: 7 days = 604800000ms
    if (value >= 1000 && value <= 604800000 && value % 1000 === 0) {
      return 'duration'
    }
    return 'number'
  }
  if (typeof value === 'object') return 'object'
  if (typeof value === 'string') {
    // Check if it's a date string in 4D !!yyyy-mm-dd!! format
    if (/^!!\d{4}-\d{2}-\d{2}!!$/.test(value)) {
      return 'date'
    }
    // Check if it's a date string in dd!mm!yyyy format
    if (/^\d{1,2}!\d{1,2}!\d{4}$/.test(value)) {
      return 'date'
    }
    // Check if it's a date string in ISO format
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return 'date'
    }
  }
  return 'text'
}

// Map catalog attribute type to internal field type
function mapCatalogTypeToFieldType(
  catalogType: string,
  kind?: string
): 'text' | 'number' | 'boolean' | 'date' | 'duration' | 'object' | 'image' | 'null' {
  switch (catalogType) {
    case 'bool':
      return 'boolean'
    case 'byte':
    case 'word':
    case 'long':
    case 'long64':
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'duration':
      return 'duration'
    case 'image':
      return 'image'
    case 'object':
      return 'object'
    case 'string':
    case 'uuid':
      return 'text'
    default:
      // If type is a dataclass name (relationship), it's an object
      // Check kind to determine if it's relatedEntity or relatedEntities
      if (kind === 'relatedEntity' || kind === 'relatedEntities') {
        return 'object'
      }
      // Default to text for unknown types
      return 'text'
  }
}

// Check if a value is a deferred relation (relatedEntity/relatedEntities), i.e.
// an object exposing a `__deferred.uri`. Image attributes also use `__deferred`
// but carry an `image` flag, so they are not treated as relations here.
function isDeferredRelationValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('__deferred' in value)) return false
  const deferred = (value as { __deferred?: unknown }).__deferred
  if (typeof deferred !== 'object' || deferred === null || !('uri' in deferred)) return false
  return !('image' in deferred && (deferred as { image?: unknown }).image)
}

// Check if a column represents a relationship type (relatedEntity or relatedEntities).
// Uses the catalog schema when available, and always also inspects the column
// values. The value check catches alias relations (whose schema kind is `alias`
// but whose value is a deferred relation) and related entity sets with no schema.
function isRelationshipType(col: string, schema?: AttributeSchema[], entities?: Entity[]): boolean {
  if (schema) {
    const attr = schema.find((a) => a.name === col)
    if (
      attr &&
      (attr.kind === 'relatedEntity' ||
        attr.kind === 'relatedEntities' ||
        attr.behavior === 'relatedEntity' ||
        attr.behavior === 'relatedEntities')
    )
      return true
  }

  if (entities) {
    for (const entity of entities) {
      const value = entity[col]
      if (value === null || value === undefined) continue
      return isDeferredRelationValue(value)
    }
  }

  return false
}

// Cell renderers with Value components

// Date cell renderer (locale from grid context)
function DateCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  const locale = (props.context as { locale?: string } | undefined)?.locale
  const formatted = formatDate(value, undefined, locale)
  // Check if the date is a null date (like !!0000-00-00!!)
  if (formatted === EMPTY_VALUE) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false} formatted={formatted}>
      <Value.Date value={formatted} />
    </CellTooltipWrapper>
  )
}

// Duration cell renderer
function DurationCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false} formatted={formatDuration(value)}>
      <Value.Duration value={value} formatter={formatDuration} />
    </CellTooltipWrapper>
  )
}

// Number cell renderer
function NumberCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false} formatted={formatNumber(value)}>
      <Value.Number value={value} formatter={formatNumber} />
    </CellTooltipWrapper>
  )
}

// Text cell renderer
function TextCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false}>
      <Value.String value={String(value)} />
    </CellTooltipWrapper>
  )
}

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
