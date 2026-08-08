/**
 * Lightweight editor preference types/defaults — kept separate from CodeEditor
 * so apps can persist prefs / i18n labels without pulling Monaco into the entry chunk.
 */

export interface EditorPrefs {
  fontSizeDelta: number
  wordWrap: boolean
  minimap: boolean
  toolbarPosition: 'top' | 'bottom'
}

export const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  fontSizeDelta: -2,
  wordWrap: false,
  minimap: false,
  toolbarPosition: 'top',
}

export interface CodeEditorLabels {
  formatDocument: string
  copyCode: string
  copied: string
  undo: string
  redo: string
  zoomIn: string
  zoomOut: string
  resetZoom: string
  enableWordWrap: string
  disableWordWrap: string
  showMinimap: string
  hideMinimap: string
  moveToolbarToTop: string
  moveToolbarToBottom: string
}

export const DEFAULT_EDITOR_LABELS: CodeEditorLabels = {
  formatDocument: 'Format document',
  copyCode: 'Copy code',
  copied: 'Copied!',
  undo: 'Undo',
  redo: 'Redo',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  enableWordWrap: 'Enable word wrap',
  disableWordWrap: 'Disable word wrap',
  showMinimap: 'Show minimap',
  hideMinimap: 'Hide minimap',
  moveToolbarToTop: 'Move toolbar to top',
  moveToolbarToBottom: 'Move toolbar to bottom',
}
