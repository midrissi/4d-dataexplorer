import type { Entity } from '~/store'

export type AttributeSchema = {
  name: string
  type: string
  kind?: string
  behavior?: string
  indexed?: boolean
  unique?: boolean
  readOnly?: boolean
}

export type EntityDataGridProps = {
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
