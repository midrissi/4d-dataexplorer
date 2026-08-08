import { themeQuartz } from 'ag-grid-community'

// Custom theme based on Quartz with design system colors.
// Theme CSS variables are full colors (oklch/hsl/#hex), not channel triplets —
// so use var(--token), never hsl(var(--token)).
export const customTheme = themeQuartz.withParams({
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
export const gridStyles = `
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
