import { CodeEditor, cn, Markdown } from '@4d/ui'
import { Braces, Code2, FileText, Globe, TableProperties } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { JsonTreePreview } from '~/components/Console/ObjectTree'
import { EmptyPanel } from '~/components/EmptyPanel'
import { HttpPreviewStage } from '~/components/HttpClient/HttpPreviewStage'
import { useTranslation } from '~/i18n'
import { looksLikeCsv, parseCsv } from '~/lib/csv'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'

export { JsonTreePreview } from '~/components/Console/ObjectTree'

export type TextPreviewMode = 'code' | 'html' | 'markdown' | 'json' | 'csv'

const TEXT_PREVIEW_MODES: TextPreviewMode[] = ['code', 'html', 'markdown', 'json', 'csv']

function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 512).toLowerCase()
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<body') ||
    (head.startsWith('<') && /<\/[a-z][\w-]*>/i.test(head))
  )
}

function looksLikeMarkdown(text: string): boolean {
  const head = text.trimStart()
  if (!head) return false
  if (/^#{1,6}\s+\S/m.test(head)) return true
  if (/^```/m.test(head)) return true
  if (/^\*\*[^*\n]+\*\*/m.test(head)) return true
  if (/^[-*+]\s+\S/m.test(head) && head.split('\n').length >= 3) return true
  return false
}

function tryParseJson(text: string): unknown | undefined {
  const trimmed = text.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return undefined
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return undefined
  }
}

/** Pick a sensible default preview mode from content shape. */
export function detectTextPreviewMode(text: string): TextPreviewMode {
  if (tryParseJson(text) !== undefined) return 'json'
  if (looksLikeHtml(text)) return 'html'
  if (looksLikeCsv(text)) return 'csv'
  if (looksLikeMarkdown(text)) return 'markdown'
  return 'code'
}

function monacoLanguageForText(text: string, mode: TextPreviewMode): string {
  if (mode === 'json') return 'json'
  if (mode === 'html') return 'html'
  if (mode === 'markdown') return 'markdown'
  if (mode === 'csv') return 'plaintext'
  if (tryParseJson(text) !== undefined) return 'json'
  if (looksLikeHtml(text)) return 'html'
  if (looksLikeMarkdown(text)) return 'markdown'
  return 'plaintext'
}

function htmlPreviewDocument(html: string, baseUrl?: string): string {
  if (!baseUrl) return html
  const hasBase = /<base\s/i.test(html)
  if (hasBase) return html
  const baseTag = `<base href="${baseUrl.replace(/"/g, '&quot;')}">`
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`)
  }
  return `${baseTag}${html}`
}

type TextPreviewPanelProps = {
  text: string
  /** Used so relative assets resolve in HTML preview. */
  baseUrl?: string
  className?: string
  /** Override initial mode; defaults to content sniffing. */
  initialMode?: TextPreviewMode
}

export function TextPreviewPanel({ text, baseUrl, className, initialMode }: TextPreviewPanelProps) {
  const { t } = useTranslation()
  const editorPrefs = useCodeEditorPrefs()
  const updateEditorPrefs = useUpdateCodeEditorPrefs()
  const suggested = useMemo(() => detectTextPreviewMode(text), [text])
  const [mode, setMode] = useState<TextPreviewMode>(initialMode ?? suggested)
  const [seenText, setSeenText] = useState(text)

  // New payload → re-sniff mode (unless parent pinned initialMode once).
  if (text !== seenText) {
    setSeenText(text)
    setMode(initialMode ?? detectTextPreviewMode(text))
  }

  const jsonValue = useMemo(() => tryParseJson(text), [text])
  const csvTable = useMemo(() => (mode === 'csv' ? parseCsv(text) : null), [mode, text])
  const language = monacoLanguageForText(text, mode)
  const htmlSrcDoc = useMemo(
    () => (mode === 'html' ? htmlPreviewDocument(text, baseUrl) : ''),
    [baseUrl, mode, text]
  )

  useEffect(() => {
    // Keep mode valid if somehow unset
    if (!TEXT_PREVIEW_MODES.includes(mode)) setMode('code')
  }, [mode])

  const modeLabel = (id: TextPreviewMode) => {
    switch (id) {
      case 'code':
        return t('httpClient.textPreviewCode')
      case 'html':
        return t('httpClient.textPreviewHtml')
      case 'markdown':
        return t('httpClient.textPreviewMarkdown')
      case 'json':
        return t('httpClient.textPreviewJson')
      case 'csv':
        return t('httpClient.textPreviewCsv')
    }
  }

  const ModeIcon = ({ id }: { id: TextPreviewMode }) => {
    switch (id) {
      case 'code':
        return <Code2 className="h-3 w-3" />
      case 'html':
        return <Globe className="h-3 w-3" />
      case 'markdown':
        return <FileText className="h-3 w-3" />
      case 'json':
        return <Braces className="h-3 w-3" />
      case 'csv':
        return <TableProperties className="h-3 w-3" />
    }
  }

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-sm border', className)}
    >
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-2 py-0.5">
        <span className="text-muted-foreground text-xs uppercase tracking-wide">
          {t('httpClient.textPreviewMode')}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-0.5">
          {TEXT_PREVIEW_MODES.map((id) => (
            <button
              key={id}
              type="button"
              className={cn(
                'inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors duration-fast',
                mode === id
                  ? 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border/70'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
              onClick={() => setMode(id)}
            >
              <ModeIcon id={id} />
              {modeLabel(id)}
              {id === suggested && mode !== id ? (
                <span className="rounded-sm bg-primary/15 px-1 text-[9px] text-primary">
                  {t('httpClient.textPreviewSuggested')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'code' ? (
          <CodeEditor
            value={text}
            language={language}
            readOnly
            height="100%"
            showLineNumbers
            toolbar
            editorPrefs={editorPrefs}
            onEditorPrefsChange={updateEditorPrefs}
            path="http-client-text-preview://body"
          />
        ) : null}

        {mode === 'html' ? (
          <HttpPreviewStage
            kind="html"
            url={baseUrl}
            badge={t('httpClient.previewStageHtml')}
            className="h-full rounded-none border-0 shadow-none"
          >
            <iframe
              title={t('httpClient.htmlPreviewAlt')}
              srcDoc={htmlSrcDoc}
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              className="h-full w-full border-0 bg-white"
            />
          </HttpPreviewStage>
        ) : null}

        {mode === 'markdown' ? (
          <div className="h-full overflow-auto bg-background px-4 py-3">
            <Markdown>{text}</Markdown>
          </div>
        ) : null}

        {mode === 'json' ? (
          jsonValue !== undefined ? (
            <JsonTreePreview value={jsonValue} label={t('httpClient.textPreviewJson')} />
          ) : (
            <EmptyPanel
              icon={Braces}
              badgeTone="muted"
              title={t('httpClient.textPreviewJsonInvalidTitle')}
              description={t('httpClient.textPreviewJsonInvalid')}
              ghost="rows"
              bordered
              size="sm"
              className="h-full"
              action={
                <button
                  type="button"
                  className="h-7 rounded-md border bg-background px-2.5 text-xs hover:bg-accent"
                  onClick={() => setMode('code')}
                >
                  {t('httpClient.textPreviewOpenAsCode')}
                </button>
              }
            />
          )
        ) : null}

        {mode === 'csv' ? (
          csvTable ? (
            <CsvTablePreview table={csvTable} />
          ) : (
            <EmptyPanel
              icon={TableProperties}
              badgeTone="muted"
              title={t('httpClient.textPreviewCsvInvalidTitle')}
              description={t('httpClient.textPreviewCsvInvalid')}
              ghost="rows"
              bordered
              size="sm"
              className="h-full"
              action={
                <button
                  type="button"
                  className="h-7 rounded-md border bg-background px-2.5 text-xs hover:bg-accent"
                  onClick={() => setMode('code')}
                >
                  {t('httpClient.textPreviewOpenAsCode')}
                </button>
              }
            />
          )
        ) : null}
      </div>
    </div>
  )
}

function CsvTablePreview({ table }: { table: NonNullable<ReturnType<typeof parseCsv>> }) {
  const { t } = useTranslation()
  const rowCount = table.rows.length
  const colCount = table.headers.length
  const columns = table.headers.map((header, position) => ({
    id: `col-${position}`,
    header,
    position,
  }))
  const dataRows = table.rows.map((cells, position) => ({
    id: `row-${position}`,
    position,
    cells: cells.map((value, cellPosition) => ({
      id: `cell-${position}-${cellPosition}`,
      value,
    })),
  }))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b px-2.5 py-0.5 text-muted-foreground text-xs">
        <TableProperties className="h-3 w-3" />
        <span>
          {t('httpClient.textPreviewCsvMeta', {
            rows: rowCount,
            cols: colCount,
          })}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="data-table w-max min-w-full">
          <thead>
            <tr>
              <th className="row-index w-10 text-center">#</th>
              {columns.map((column) => (
                <th key={column.id} className="max-w-72 truncate" title={column.header}>
                  {column.header || (
                    <span className="text-muted-foreground/70 italic">
                      {t('httpClient.textPreviewCsvEmptyHeader', {
                        index: column.position + 1,
                      })}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row) => (
              <tr key={row.id}>
                <td className="row-index text-center">{row.position + 1}</td>
                {row.cells.map((cell) => (
                  <td key={cell.id} className="max-w-72 truncate" title={cell.value}>
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
