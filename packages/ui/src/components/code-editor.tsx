import { Editor, loader } from '@monaco-editor/react'
import {
  AlignLeft,
  Check,
  Copy,
  Map as MapIcon,
  PanelBottom,
  PanelTop,
  Redo2,
  RotateCcw,
  Undo2,
  WrapText,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type * as Monaco from 'monaco-editor'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'
import {
  type CodeEditorLabels,
  DEFAULT_EDITOR_LABELS,
  DEFAULT_EDITOR_PREFS,
  type EditorPrefs,
} from './editor-prefs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

export type { CodeEditorLabels, EditorPrefs } from './editor-prefs'
export { DEFAULT_EDITOR_LABELS, DEFAULT_EDITOR_PREFS } from './editor-prefs'

/* ------------------------------------------------------------------ */
/*  Schema completion helpers                                          */
/* ------------------------------------------------------------------ */

type SchemaLike = {
  type?: string
  properties?: Record<string, SchemaLike>
  enum?: unknown[]
  const?: unknown
  [key: string]: unknown
}

type CompletionEntry = {
  value: string
  caption?: string
  meta?: string
  score?: number
}

function getContextAndDepth(
  text: string,
  row: number,
  column: number
): { context: 'key' | 'value'; depth: number } | null {
  const lines = text.split('\n')
  if (row < 0 || row >= lines.length) return null
  const beforeCursor = (lines[row].slice(0, column) + lines.slice(0, row).join('\n')).trim()

  let depth = 0
  let inString = false
  let escaped = false
  let quote = ''
  for (const c of beforeCursor) {
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (c === '\\') escaped = true
      else if (c === quote) inString = false
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      quote = c
      continue
    }
    if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') depth--
  }

  const trimmed = beforeCursor.replace(/\s*$/, '')
  if (trimmed.endsWith(':') || trimmed.endsWith('":')) return { context: 'value', depth }
  return { context: 'key', depth }
}

function getCurrentKey(text: string, row: number, column: number): string | null {
  const lines = text.split('\n')
  const before = lines.slice(0, row).join('\n') + (lines[row] ?? '').slice(0, column)
  const match = before.match(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*$/)
  return match ? match[1].replace(/\\"/g, '"') : null
}

function getObjectProperties(schema: SchemaLike | null): Record<string, SchemaLike> | null {
  if (!schema || typeof schema !== 'object') return null
  if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object')
    return schema.properties
  return null
}

function getValueSuggestions(schema: SchemaLike | null): CompletionEntry[] {
  if (!schema || typeof schema !== 'object') return []
  const out: CompletionEntry[] = []
  if (Array.isArray(schema.enum)) {
    for (const v of schema.enum) {
      out.push({
        value: typeof v === 'string' ? JSON.stringify(v) : String(v),
        meta: 'enum',
        score: 100,
      })
    }
  }
  if (schema.const !== undefined) {
    out.push({
      value: typeof schema.const === 'string' ? JSON.stringify(schema.const) : String(schema.const),
      meta: 'const',
      score: 101,
    })
  }
  if (schema.type === 'boolean') {
    out.push({ value: 'true', meta: 'boolean', score: 50 })
    out.push({ value: 'false', meta: 'boolean', score: 50 })
  }
  if (schema.type === 'null') {
    out.push({ value: 'null', meta: 'null', score: 50 })
  }
  return out
}

function getPresentRootKeys(text: string): Set<string> {
  const keys = new Set<string>()
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const k of Object.keys(parsed)) keys.add(k)
    }
  } catch {
    let depth = 0
    let inStr = false
    let escaped = false
    let q = ''
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (inStr) {
        if (c === '\\') escaped = true
        else if (c === q) inStr = false
        continue
      }
      if (c === '"' || c === "'") {
        inStr = true
        q = c
        continue
      }
      if (c === '{' || c === '[') depth++
      else if (c === '}' || c === ']') depth--
      if (depth === 1 && c === '"') {
        const m = text.slice(i).match(/^"([^"]+)"\s*:/)
        if (m) keys.add(m[1])
      }
    }
  }
  return keys
}

function schemaCompletions(
  schema: SchemaLike,
  text: string,
  row: number,
  column: number
): CompletionEntry[] {
  const ctx = getContextAndDepth(text, row, column)
  if (!ctx) return []

  if (ctx.context === 'key' && ctx.depth === 1) {
    const props = getObjectProperties(schema)
    if (!props) return []
    const present = getPresentRootKeys(text)
    return Object.keys(props)
      .filter((k) => !present.has(k))
      .map((key) => {
        const p = props[key]
        const type = p && typeof p === 'object' && 'type' in p ? String(p.type) : '?'
        return { value: `"${key.replace(/"/g, '\\"')}"`, caption: key, meta: type, score: 90 }
      })
  }

  if (ctx.context === 'value' && ctx.depth === 1) {
    const currentKey = getCurrentKey(text, row, column)
    if (!currentKey) return []
    const props = getObjectProperties(schema)
    if (!props || !(currentKey in props)) return []
    return getValueSuggestions(props[currentKey] as SchemaLike)
  }

  return []
}

/* ------------------------------------------------------------------ */
/*  Monaco JSON $schema URL support                                    */
/* ------------------------------------------------------------------ */

let jsonSchemaRequestConfigured = false
function configureJsonSchemaRequest(monaco: typeof Monaco) {
  if (jsonSchemaRequestConfigured) return
  jsonSchemaRequestConfigured = true
  const defaults = monaco.json.jsonDefaults
  defaults.setDiagnosticsOptions({
    ...defaults.diagnosticsOptions,
    enableSchemaRequest: true,
    schemaRequest: 'ignore',
  })
  defaults.setModeConfiguration({
    ...defaults.modeConfiguration,
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    diagnostics: true,
  })
}

/**
 * Ensures Monaco is loaded and JSON schema request is enabled (so $schema URLs are fetched).
 * Optional preload on intent (e.g. hover to open an editor). CodeEditor also configures
 * this in `beforeMount` so startup does not need to pull Monaco into the entry chunk.
 */
export function ensureMonacoJsonSchemaRequest(): Promise<void> {
  return loader.init().then(configureJsonSchemaRequest)
}

/** Parses JSON text and returns the $schema URL if present (string). */
function getSchemaUriFromJsonText(text: string | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as { $schema?: string }
    const uri = parsed?.$schema
    return typeof uri === 'string' && /^https?:\/\//i.test(uri) ? uri : null
  } catch {
    return null
  }
}

/* Transparent editor/minimap theme names; redefined on each Monaco mount so color updates apply */
const TRANSPARENT_THEME_LIGHT = 'dataexplorer-vs-transparent'
const TRANSPARENT_THEME_DARK = 'dataexplorer-vs-dark-transparent'

function defineTransparentThemes(monaco: typeof Monaco): void {
  monaco.editor.defineTheme(TRANSPARENT_THEME_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#00000000',
      'minimap.background': '#00000000',
      'editorOverviewRuler.background': '#00000000',
      'scrollbar.shadow': '#00000000',
    },
  })
  monaco.editor.defineTheme(TRANSPARENT_THEME_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#00000000',
      'minimap.background': '#00000000',
      'editorOverviewRuler.background': '#00000000',
      'scrollbar.shadow': '#00000000',
    },
  })
}

/* ------------------------------------------------------------------ */
/*  Overflow widgets container (preserves Monaco theme for hover)       */
/* ------------------------------------------------------------------ */

let overflowWidgetsContainer: HTMLDivElement | null = null

function getOverflowWidgetsDomNode(theme: 'vs' | 'vs-dark'): HTMLDivElement | undefined {
  if (typeof document === 'undefined') return undefined
  if (!overflowWidgetsContainer) {
    overflowWidgetsContainer = document.createElement('div')
    overflowWidgetsContainer.className = 'monaco-editor'
    overflowWidgetsContainer.setAttribute('aria-hidden', 'true')
    Object.assign(overflowWidgetsContainer.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      zIndex: '10000',
      pointerEvents: 'none',
    })
    document.body.appendChild(overflowWidgetsContainer)
  }
  overflowWidgetsContainer.className = `monaco-editor ${theme}`
  return overflowWidgetsContainer
}

/* ------------------------------------------------------------------ */
/*  Per-model JSON schema (built-in completion + validation)           */
/* ------------------------------------------------------------------ */

const schemaRegistry = new Map<string, Record<string, unknown>>()

function updateMonacoJsonSchemas(monaco: typeof Monaco) {
  const defaults = monaco.json.jsonDefaults
  const current = defaults.diagnosticsOptions
  const existing = (current.schemas ?? []).filter((s) => {
    const match = (s as { fileMatch?: string[] }).fileMatch?.[0]
    return match == null || !schemaRegistry.has(match)
  })
  const fromRegistry = Array.from(schemaRegistry.entries()).map(([uri, schema]) => ({
    uri: `${uri}#`,
    fileMatch: [uri],
    schema,
  }))
  defaults.setDiagnosticsOptions({
    ...current,
    schemas: [...existing, ...fromRegistry],
  })
}

/* ------------------------------------------------------------------ */
/*  Persisted preferences (localStorage or controlled via props)       */
/* ------------------------------------------------------------------ */

const PREFS_KEY = 'code-editor-prefs'

let prefsCache: EditorPrefs | null = null

function loadPrefs(): EditorPrefs {
  if (prefsCache) return prefsCache
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const merged: EditorPrefs = { ...DEFAULT_EDITOR_PREFS, ...JSON.parse(raw) }
      prefsCache = merged
      return merged
    }
  } catch {
    /* ignore */
  }
  const fallback: EditorPrefs = { ...DEFAULT_EDITOR_PREFS }
  prefsCache = fallback
  return fallback
}

function persistPrefs(next: EditorPrefs): void {
  prefsCache = next
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

const prefsListeners = new Set<() => void>()

function useEditorPrefs(): [EditorPrefs, (update: Partial<EditorPrefs>) => void] {
  const [prefs, setPrefs] = useState(loadPrefs)

  useEffect(() => {
    const handler = () => setPrefs(loadPrefs())
    prefsListeners.add(handler)
    return () => {
      prefsListeners.delete(handler)
    }
  }, [])

  const update = useCallback((partial: Partial<EditorPrefs>) => {
    const next = { ...loadPrefs(), ...partial }
    persistPrefs(next)
    setPrefs(next)
    for (const fn of prefsListeners) fn()
  }, [])

  return [prefs, update]
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type CodeEditorInstance = Monaco.editor.IStandaloneCodeEditor

export type ToolId =
  | 'format'
  | 'copy'
  | 'undo'
  | 'redo'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'word-wrap'
  | 'minimap'
  | 'toolbar-position'

export interface ToolbarConfig {
  /** @default 'top' */
  position?: 'top' | 'bottom'
  /** Subset of tools to display. Defaults to all tools. */
  tools?: ToolId[]
}

export interface CodeEditorProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  /** Monaco language id. @default 'json' */
  language?: string
  /**
   * JSON Schema object — enables property/value autocomplete when provided.
   * When omitted for JSON, the editor loads the schema from the document's `$schema` URI if present.
   */
  schema?: Record<string, unknown>
  /** @default '200px' */
  height?: string | number
  /** @default 13 */
  fontSize?: number
  /**
   * Monaco line height. Values &lt; 8 are multipliers of font size; ≥ 8 are pixels.
   * @default 1.6
   */
  lineHeight?: number
  /** Editor content padding. @default { top: 8, bottom: 8 } */
  padding?: { top?: number; bottom?: number }
  /** Explicit theme override. Auto-detected from document `dark` class when omitted. */
  theme?: 'light' | 'dark'
  /** @default false */
  showLineNumbers?: boolean
  /** @default false */
  readOnly?: boolean
  /** When set, overrides saved preference. When omitted, uses saved preference (default false). */
  wordWrap?: boolean
  /**
   * Monaco word-based suggestions. Use `'off'` for languages with a custom
   * completion provider (e.g. ORDA) to avoid duplicate keyword/value noise.
   * @default 'matchingDocuments'
   */
  wordBasedSuggestions?: false | 'off' | 'currentDocument' | 'matchingDocuments'
  /**
   * `false` / `undefined` → no toolbar.
   * `true` → all tools, position from saved preference.
   * `ToolbarConfig` → fine-grained control.
   */
  toolbar?: boolean | ToolbarConfig
  /** Toolbar label overrides for i18n. Merges with English defaults. */
  labels?: Partial<CodeEditorLabels>
  /**
   * When provided with onEditorPrefsChange, prefs are controlled (e.g. from app profile).
   * When omitted, prefs are stored in localStorage under code-editor-prefs.
   */
  editorPrefs?: EditorPrefs
  /** Called when user changes editor prefs (zoom, word wrap, minimap, toolbar position). */
  onEditorPrefsChange?: (partial: Partial<EditorPrefs>) => void
  /** Model path/URI for multi-model support. */
  path?: string
  /** Validation markers shown in the gutter (0-based row/column). */
  annotations?: Array<{ row: number; column: number; text: string; type?: 'error' | 'warning' }>
  /** Shows a destructive border when true. */
  error?: boolean
  className?: string
  /** @default false */
  highlightActiveLine?: boolean
  /** Called after the editor mounts with both editor and monaco instances. */
  onMount?: (editor: CodeEditorInstance, monaco: typeof Monaco) => void
}

/* ------------------------------------------------------------------ */
/*  Tool layout constants                                              */
/* ------------------------------------------------------------------ */

const ALL_TOOLS: ToolId[] = [
  'format',
  'copy',
  'undo',
  'redo',
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'word-wrap',
  'minimap',
  'toolbar-position',
]

/** Pretty-print JSON text; returns null when the payload is not valid JSON. */
function tryFormatJson(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null
  try {
    return JSON.stringify(JSON.parse(trimmed) as unknown, null, 2)
  } catch {
    return null
  }
}

const TOOL_GROUPS: ToolId[][] = [
  ['format', 'copy'],
  ['undo', 'redo'],
  ['zoom-in', 'zoom-out', 'zoom-reset'],
  ['word-wrap', 'minimap'],
]

interface ToolDef {
  id: ToolId
  label: string
  icon: ReactNode
  action: () => void
  active?: boolean
  disabled?: boolean
}

/* ------------------------------------------------------------------ */
/*  EditorToolbar (internal)                                           */
/* ------------------------------------------------------------------ */

function EditorToolbar({
  tools,
  position,
  getToolDefs,
}: {
  tools: ToolId[]
  position: 'top' | 'bottom'
  getToolDefs: () => ToolDef[]
}) {
  const defs = getToolDefs()
  const toolSet = new Set(tools)

  const groups: ToolDef[][] = []
  for (const group of TOOL_GROUPS) {
    const matched = group
      .filter((id) => toolSet.has(id))
      .map((id) => defs.find((d) => d.id === id))
      .filter((d): d is ToolDef => d != null)
    if (matched.length) groups.push(matched)
  }

  const positionTool = toolSet.has('toolbar-position')
    ? defs.find((d) => d.id === 'toolbar-position')
    : null

  if (!groups.length && !positionTool) return null

  const renderTool = (tool: ToolDef) => (
    <Tooltip key={tool.id}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="iconXs"
          onClick={tool.action}
          disabled={tool.disabled}
          className={cn(
            'text-muted-foreground hover:text-foreground',
            tool.active && 'bg-accent text-accent-foreground'
          )}
          aria-label={tool.label}
        >
          {tool.icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={position === 'top' ? 'bottom' : 'top'} className="text-xs">
        {tool.label}
      </TooltipContent>
    </Tooltip>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex min-h-7 shrink-0 items-center gap-1 px-2.5 py-1',
          position === 'top' ? 'border-border border-b' : 'border-border border-t',
          'bg-muted/30'
        )}
      >
        {groups.map((group, gi) => (
          <div key={group.map((t) => t.id).join()} className="flex items-center gap-0.5">
            {gi > 0 ? (
              <div className="mr-1 ml-0.5 h-3.5 w-px shrink-0 bg-border" aria-hidden />
            ) : null}
            {group.map(renderTool)}
          </div>
        ))}
        {positionTool && (
          <>
            <div className="flex-1" />
            {renderTool(positionTool)}
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

/* ------------------------------------------------------------------ */
/*  CodeEditor                                                         */
/* ------------------------------------------------------------------ */

const MIN_FONT = 8
const MAX_FONT = 32
const FONT_STEP = 2
/** Floor for flex (`height="100%"`) editors so the Monaco pane never collapses under the toolbar. */
const MIN_FLEX_EDITOR_HEIGHT_PX = 160
const MIN_FLEX_EDITOR_BODY_PX = 120

export function CodeEditor({
  value,
  defaultValue,
  onChange,
  onBlur,
  language = 'json',
  schema,
  height = '200px',
  fontSize: fontSizeProp = 13,
  lineHeight: lineHeightProp = 1.6,
  padding: paddingProp,
  theme: themeProp,
  showLineNumbers = false,
  readOnly = false,
  wordWrap: wordWrapProp,
  wordBasedSuggestions: wordBasedSuggestionsProp,
  toolbar: toolbarProp,
  labels: labelsProp,
  editorPrefs: editorPrefsProp,
  onEditorPrefsChange,
  path: pathProp,
  annotations,
  error,
  className,
  highlightActiveLine = false,
  onMount: onMountProp,
}: CodeEditorProps) {
  const editorRef = useRef<CodeEditorInstance | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const schemaRef = useRef<Record<string, unknown> | undefined>(schema)
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations
  const completionRef = useRef<Monaco.IDisposable | null>(null)
  const registeredSchemaUriRef = useRef<string | null>(null)
  const lastFetchedSchemaUriRef = useRef<string | null>(null)
  const [schemaFromUri, setSchemaFromUri] = useState<Record<string, unknown> | null>(null)

  /* ---- preferences ---- */

  const internalPrefs = useEditorPrefs()
  const isControlled = editorPrefsProp !== undefined && typeof onEditorPrefsChange === 'function'
  const prefs: EditorPrefs = isControlled
    ? { ...DEFAULT_EDITOR_PREFS, ...editorPrefsProp }
    : internalPrefs[0]
  const updatePrefs =
    isControlled && typeof onEditorPrefsChange === 'function'
      ? onEditorPrefsChange
      : internalPrefs[1]

  const currentFontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, fontSizeProp + prefs.fontSizeDelta))
  const isWordWrap = wordWrapProp ?? prefs.wordWrap
  const isMinimapOn = prefs.minimap

  /* ---- toolbar config ---- */

  const showToolbar = toolbarProp !== undefined && toolbarProp !== false
  const toolbarConfig: ToolbarConfig | null = showToolbar
    ? typeof toolbarProp === 'object'
      ? toolbarProp
      : {}
    : null
  const toolbarPosition = toolbarConfig?.position ?? prefs.toolbarPosition
  const toolbarTools = toolbarConfig?.tools ?? ALL_TOOLS

  /* ---- labels ---- */

  const l: CodeEditorLabels = labelsProp
    ? { ...DEFAULT_EDITOR_LABELS, ...labelsProp }
    : DEFAULT_EDITOR_LABELS

  /* ---- theme ---- */

  const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark'>('vs')

  useEffect(() => {
    if (themeProp) {
      setEditorTheme(themeProp === 'dark' ? 'vs-dark' : 'vs')
      return
    }
    const sync = () =>
      setEditorTheme(document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs')
    sync()
    const observer = new MutationObserver((muts) => {
      for (const m of muts) if (m.attributeName === 'class') sync()
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [themeProp])

  // Themes are registered in `beforeMount` before the editor is created, so we
  // can always point at the transparent variants (no mount-time setState race).
  const monacoTheme = editorTheme === 'vs-dark' ? TRANSPARENT_THEME_DARK : TRANSPARENT_THEME_LIGHT

  /* ---- push option changes to Monaco ---- */

  const [copied, setCopied] = useState(false)

  /* ---- read-only format: keep a local pretty-printed override ---- */
  const [formatOverride, setFormatOverride] = useState<string | null>(null)
  const [seenValue, setSeenValue] = useState(value)
  if (value !== seenValue) {
    setSeenValue(value)
    setFormatOverride(null)
  }
  const displayValue = formatOverride ?? value

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: currentFontSize })
  }, [currentFontSize])

  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: isWordWrap ? 'on' : 'off' })
  }, [isWordWrap])

  useEffect(() => {
    editorRef.current?.updateOptions({ minimap: { enabled: isMinimapOn } })
  }, [isMinimapOn])

  /* ---- annotations → markers ---- */

  const syncAnnotations = useCallback(
    (editor: CodeEditorInstance, monaco: typeof Monaco, ann: CodeEditorProps['annotations']) => {
      // Monaco-react can re-fire onMount with a null editor during Strict Mode
      // reconnect / dispose races — bail before touching the API.
      if (!editor || !monaco) return
      const model = editor.getModel()
      if (!model) return
      if (!ann?.length) {
        monaco.editor.setModelMarkers(model, 'code-editor', [])
        return
      }
      monaco.editor.setModelMarkers(
        model,
        'code-editor',
        ann.map((a) => ({
          severity:
            a.type === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
          message: a.text,
          startLineNumber: a.row + 1,
          startColumn: a.column + 1,
          endLineNumber: a.row + 1,
          endColumn: Math.max(a.column + 1, a.column + 20),
        }))
      )
    },
    []
  )

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (editor && monaco) syncAnnotations(editor, monaco, annotations)
  }, [annotations, syncAnnotations])

  /* ---- schema completion provider ---- */

  const registerSchemaProvider = useCallback((schemaObj: Record<string, unknown> | undefined) => {
    completionRef.current?.dispose()
    completionRef.current = null

    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !schemaObj) return

    const model = editor.getModel()
    if (!model) return

    completionRef.current = monaco.languages.registerCompletionItemProvider(model.getLanguageId(), {
      triggerCharacters: ['"', ':'],
      provideCompletionItems(m, position) {
        if (m !== model) return { suggestions: [] }
        const text = m.getValue()
        const items = schemaCompletions(
          schemaRef.current as SchemaLike,
          text,
          position.lineNumber - 1,
          position.column - 1
        )
        const word = m.getWordUntilPosition(position)
        const range: Monaco.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        }
        return {
          suggestions: items.map((c) => ({
            label: c.caption ?? c.value.replace(/^"|"$/g, ''),
            insertText: c.value,
            kind: monaco.languages.CompletionItemKind.Property,
            detail: c.meta,
            range,
          })),
        }
      },
    })
  }, [])

  /* ---- fetch schema from document $schema URI when no schema prop (e.g. Schema editor) ---- */

  useEffect(() => {
    if (language !== 'json' || (schema != null && typeof schema === 'object')) {
      setSchemaFromUri(null)
      lastFetchedSchemaUriRef.current = null
      return
    }
    const schemaUri = getSchemaUriFromJsonText(value)
    if (!schemaUri) {
      setSchemaFromUri(null)
      lastFetchedSchemaUriRef.current = null
      return
    }
    if (schemaUri === lastFetchedSchemaUriRef.current) return
    lastFetchedSchemaUriRef.current = schemaUri
    let cancelled = false
    fetch(schemaUri)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: Record<string, unknown>) => {
        if (!cancelled) setSchemaFromUri(data)
      })
      .catch(() => {
        if (!cancelled) setSchemaFromUri(null)
      })
    return () => {
      cancelled = true
    }
  }, [language, schema, value])

  const effectiveSchema = schema && typeof schema === 'object' ? schema : schemaFromUri
  schemaRef.current = effectiveSchema ?? undefined

  useEffect(() => {
    registerSchemaProvider(effectiveSchema ?? undefined)
  }, [effectiveSchema, registerSchemaProvider])

  /* ---- register schema with Monaco JSON language service (built-in completion + validation) ---- */

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const model = editor?.getModel()
    if (language !== 'json' || !monaco || !model) return
    const uri = model.uri.toString()
    if (effectiveSchema) {
      schemaRegistry.set(uri, effectiveSchema)
      registeredSchemaUriRef.current = uri
    } else {
      schemaRegistry.delete(uri)
      if (registeredSchemaUriRef.current === uri) registeredSchemaUriRef.current = null
    }
    updateMonacoJsonSchemas(monaco)
  }, [language, effectiveSchema])

  useEffect(
    () => () => {
      if (registeredSchemaUriRef.current && monacoRef.current) {
        schemaRegistry.delete(registeredSchemaUriRef.current)
        updateMonacoJsonSchemas(monacoRef.current)
        registeredSchemaUriRef.current = null
      }
    },
    []
  )

  useEffect(() => () => completionRef.current?.dispose(), [])

  /* ---- tool definitions ---- */

  const applyFormattedText = useCallback(
    (next: string) => {
      if (onChange) {
        onChange(next)
        return
      }
      if (readOnly) {
        setFormatOverride(next)
        return
      }
      editorRef.current?.setValue(next)
    },
    [onChange, readOnly]
  )

  const formatDocument = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return

    const current = editor.getValue()
    if (language === 'json' || tryFormatJson(current) !== null) {
      const pretty = tryFormatJson(current)
      if (pretty != null && pretty !== current) {
        applyFormattedText(pretty)
        return
      }
      if (pretty != null) return
    }

    const wasReadOnly = readOnly
    if (wasReadOnly) editor.updateOptions({ readOnly: false })
    try {
      await editor.getAction('editor.action.formatDocument')?.run()
      const next = editor.getValue()
      if (next !== current) applyFormattedText(next)
    } finally {
      if (wasReadOnly) editor.updateOptions({ readOnly: true })
    }
  }, [applyFormattedText, language, readOnly])

  const getToolDefs = useCallback(
    (): ToolDef[] => [
      {
        id: 'format',
        label: l.formatDocument,
        icon: <AlignLeft />,
        action: () => {
          void formatDocument()
        },
      },
      {
        id: 'copy',
        label: copied ? l.copied : l.copyCode,
        icon: copied ? <Check /> : <Copy />,
        action: () => {
          const text = editorRef.current?.getValue()
          if (!text) return
          navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        },
      },
      {
        id: 'undo',
        label: l.undo,
        icon: <Undo2 />,
        action: () => editorRef.current?.trigger('toolbar', 'undo', null),
        disabled: readOnly,
      },
      {
        id: 'redo',
        label: l.redo,
        icon: <Redo2 />,
        action: () => editorRef.current?.trigger('toolbar', 'redo', null),
        disabled: readOnly,
      },
      {
        id: 'zoom-in',
        label: l.zoomIn,
        icon: <ZoomIn />,
        action: () =>
          updatePrefs({
            fontSizeDelta: Math.min(prefs.fontSizeDelta + FONT_STEP, MAX_FONT - fontSizeProp),
          }),
      },
      {
        id: 'zoom-out',
        label: l.zoomOut,
        icon: <ZoomOut />,
        action: () =>
          updatePrefs({
            fontSizeDelta: Math.max(prefs.fontSizeDelta - FONT_STEP, MIN_FONT - fontSizeProp),
          }),
      },
      {
        id: 'zoom-reset',
        label: l.resetZoom,
        icon: <RotateCcw />,
        action: () => updatePrefs({ fontSizeDelta: DEFAULT_EDITOR_PREFS.fontSizeDelta }),
        disabled: prefs.fontSizeDelta === DEFAULT_EDITOR_PREFS.fontSizeDelta,
      },
      {
        id: 'word-wrap',
        label: isWordWrap ? l.disableWordWrap : l.enableWordWrap,
        icon: <WrapText />,
        action: () => updatePrefs({ wordWrap: !isWordWrap }),
        active: isWordWrap,
      },
      {
        id: 'minimap',
        label: isMinimapOn ? l.hideMinimap : l.showMinimap,
        icon: <MapIcon />,
        action: () => updatePrefs({ minimap: !isMinimapOn }),
        active: isMinimapOn,
      },
      {
        id: 'toolbar-position',
        label: toolbarPosition === 'top' ? l.moveToolbarToBottom : l.moveToolbarToTop,
        icon: toolbarPosition === 'top' ? <PanelBottom /> : <PanelTop />,
        action: () =>
          updatePrefs({ toolbarPosition: toolbarPosition === 'top' ? 'bottom' : 'top' }),
      },
    ],
    [
      l,
      copied,
      readOnly,
      fontSizeProp,
      prefs.fontSizeDelta,
      isWordWrap,
      isMinimapOn,
      toolbarPosition,
      updatePrefs,
      formatDocument,
    ]
  )

  /* ---- editor options ---- */

  const options: Monaco.editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      fontSize: currentFontSize,
      lineNumbers: showLineNumbers ? 'on' : 'off',
      lineNumbersMinChars: 2,
      lineDecorationsWidth: showLineNumbers ? 8 : 0,
      glyphMargin: false,
      folding: false,
      wordWrap: isWordWrap ? 'on' : 'off',
      minimap: { enabled: isMinimapOn },
      tabSize: 2,
      insertSpaces: true,
      scrollBeyondLastLine: false,
      renderLineHighlight: highlightActiveLine ? 'line' : 'none',
      // Avoid the thin dark overview-ruler gutter on the far right.
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false,
      },
      lineHeight: lineHeightProp,
      padding: {
        top: paddingProp?.top ?? 8,
        bottom: paddingProp?.bottom ?? 8,
      },
      readOnly,
      quickSuggestions: { other: true, comments: false, strings: true },
      quickSuggestionsDelay: 100,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      wordBasedSuggestions:
        wordBasedSuggestionsProp === false || wordBasedSuggestionsProp === 'off'
          ? 'off'
          : (wordBasedSuggestionsProp ?? 'matchingDocuments'),
      // Render hover/diagnostic in a themed container so it isn't clipped and keeps Monaco's theme
      ...(typeof document !== 'undefined' && {
        overflowWidgetsDomNode: getOverflowWidgetsDomNode(editorTheme),
        fixedOverflowWidgets: true,
      }),
    }),
    [
      currentFontSize,
      showLineNumbers,
      isWordWrap,
      isMinimapOn,
      highlightActiveLine,
      readOnly,
      editorTheme,
      wordBasedSuggestionsProp,
      lineHeightProp,
      paddingProp?.top,
      paddingProp?.bottom,
    ]
  )

  // Drop stale Monaco refs after unmount / dispose so later effects never call into a dead editor.
  useEffect(
    () => () => {
      editorRef.current = null
      monacoRef.current = null
    },
    []
  )

  const needsFlexHeight = height === '100%' || height === 'inherit'
  const resolvedHeight =
    typeof height === 'number'
      ? Math.max(height, showToolbar ? MIN_FLEX_EDITOR_BODY_PX : 80)
      : height

  /* ---- render ---- */

  const toolbar = showToolbar ? (
    <EditorToolbar tools={toolbarTools} position={toolbarPosition} getToolDefs={getToolDefs} />
  ) : null

  return (
    <div
      data-code-editor
      className={cn(
        // Opaque surface so Monaco’s transparent chrome (scrollbar / minimap)
        // never reveals a black ancestor gap on the right edge.
        'flex flex-col overflow-hidden rounded-md border border-input bg-background [&_.monaco-editor]:bg-transparent! [&_.monaco-editor_.monaco-editor-background]:bg-transparent!',
        needsFlexHeight && 'h-full',
        !showLineNumbers && '[&_.monaco-editor_.margin]:w-0!',
        error && 'border-destructive',
        className
      )}
      style={
        needsFlexHeight
          ? { minHeight: MIN_FLEX_EDITOR_HEIGHT_PX }
          : typeof resolvedHeight === 'number'
            ? { minHeight: resolvedHeight + (showToolbar ? 28 : 0) }
            : undefined
      }
    >
      {toolbarPosition === 'top' && toolbar}
      <div
        className={cn('relative w-full min-w-0', needsFlexHeight && 'flex-1')}
        style={
          needsFlexHeight
            ? { minHeight: MIN_FLEX_EDITOR_BODY_PX }
            : typeof resolvedHeight === 'number'
              ? { minHeight: resolvedHeight }
              : undefined
        }
      >
        <Editor
          height={needsFlexHeight ? '100%' : resolvedHeight}
          language={language}
          theme={monacoTheme}
          value={displayValue}
          defaultValue={defaultValue}
          path={pathProp}
          // Keep models alive when keyed by path so fast unmount/remount does not
          // race Monaco workers against a disposed model (getModel → null).
          keepCurrentModel={Boolean(pathProp)}
          onChange={(v) => onChange?.(v ?? '')}
          beforeMount={(monaco) => {
            defineTransparentThemes(monaco)
            // Configure JSON $schema requests before the editor/worker start so
            // apps do not need an eager Monaco init in the entry bundle.
            configureJsonSchemaRequest(monaco)
          }}
          onMount={(editor, monaco) => {
            // Strict Mode / tab switches can re-invoke onMount after dispose with
            // a null editor instance — ignore those calls entirely.
            if (!editor || !monaco) return
            editorRef.current = editor
            monacoRef.current = monaco
            if (language === 'json') {
              const schemaObj = schemaRef.current
              if (schemaObj && typeof schemaObj === 'object') {
                const model = editor.getModel()
                if (model) {
                  const uri = model.uri.toString()
                  schemaRegistry.set(uri, schemaObj)
                  registeredSchemaUriRef.current = uri
                  updateMonacoJsonSchemas(monaco)
                }
              }
            }
            if (onBlur) editor.onDidBlurEditorText(onBlur)
            syncAnnotations(editor, monaco, annotationsRef.current)
            registerSchemaProvider(schemaRef.current)
            // Alt+Space triggers the autocomplete/suggest widget (in addition
            // to Monaco's default Ctrl/Cmd+Space, which some OSes intercept).
            editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Space, () => {
              editor.trigger('keyboard', 'editor.action.triggerSuggest', {})
            })
            onMountProp?.(editor, monaco)
          }}
          options={options}
          loading={null}
        />
      </div>
      {toolbarPosition === 'bottom' && toolbar}
    </div>
  )
}
