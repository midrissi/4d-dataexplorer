import { ClickToCopy, CodeEditor, cn } from '@4d/ui'
import { Cookie, Copy, FileJson, Inbox, Send, TableProperties } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import { PrivateBinaryResult } from '~/components/DecodedBinary/PrivateBinaryResult'
import { EmptyPanel } from '~/components/EmptyPanel'
import { HttpPreviewStage } from '~/components/HttpClient/HttpPreviewStage'
import { HttpResponseBinaryBody } from '~/components/HttpClient/HttpResponseBinaryBody'
import { HttpResponseErrorBody } from '~/components/HttpClient/HttpResponseErrorBody'
import { JsonTreePreview, TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { detectMethodResult } from '~/components/MethodExecutor/detect-method-result'
import { ResultPanel } from '~/components/MethodExecutor/ResultPanel'
import { useTranslation } from '~/i18n'
import { isCsvContentType, looksLikeCsv } from '~/lib/csv'
import {
  formatByteSize,
  formatResponseBody,
  monacoLanguageForRaw,
  rawLanguageFromContentType,
} from '~/lib/http-client'
import type { HttpClientResponse } from '~/store/http-client-types'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'

type ResponseTab = 'body' | 'headers' | 'cookies'
type BodyView = 'preview' | 'raw'

function isHtmlContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  return ct.includes('text/html') || ct.includes('application/xhtml')
}

function looksLikeHtml(bodyText: string): boolean {
  const head = bodyText.trimStart().slice(0, 512).toLowerCase()
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<body')
  )
}

function htmlPreviewDocument(html: string, baseUrl: string): string {
  const hasBase = /<base\s/i.test(html)
  if (hasBase || !baseUrl) return html
  const baseTag = `<base href="${baseUrl.replace(/"/g, '&quot;')}">`
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`)
  }
  return `${baseTag}${html}`
}

export function HttpResponsePanel({ response }: { response: HttpClientResponse | null }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ResponseTab>('body')
  const [bodyView, setBodyView] = useState<BodyView>('preview')
  const [bodyViewResponse, setBodyViewResponse] = useState(response)
  const editorPrefs = useCodeEditorPrefs()
  const updateEditorPrefs = useUpdateCodeEditorPrefs()

  // Prefer console-style JSON / HTML / entity preview when a new response arrives.
  if (response !== bodyViewResponse) {
    setBodyViewResponse(response)
    setBodyView('preview')
  }

  const bodyText = useMemo(() => (response ? formatResponseBody(response) : ''), [response])
  const language = useMemo(() => {
    if (!response) return 'plaintext'
    if (response.bodyJson !== null && response.bodyJson !== undefined) return 'json'
    return monacoLanguageForRaw(rawLanguageFromContentType(response.contentType))
  }, [response])

  const detected = useMemo(() => {
    if (!response || response.error || response.bodyJson == null) return null
    return detectMethodResult(response.bodyJson)
  }, [response])

  const isEntityBody =
    detected != null && (detected.kind === 'entity' || detected.kind === 'entitysel')
  const isBinaryBody = Boolean(response?.bodyBinary)
  const isJsonBody =
    !isBinaryBody && response?.bodyJson !== null && response?.bodyJson !== undefined
  const privateBinaryValue =
    detected?.kind === 'other' && isPrivateBinaryObject(detected.value)
      ? detected.value
      : isPrivateBinaryObject(response?.bodyJson)
        ? response.bodyJson
        : null
  const isPrivateBinaryBody = isJsonBody && privateBinaryValue != null
  const isHtmlBody =
    !isBinaryBody &&
    !isEntityBody &&
    !isJsonBody &&
    Boolean(bodyText) &&
    (isHtmlContentType(response?.contentType) || looksLikeHtml(bodyText))
  const isCsvBody =
    !isBinaryBody &&
    !isEntityBody &&
    !isJsonBody &&
    !isHtmlBody &&
    Boolean(bodyText) &&
    (isCsvContentType(response?.contentType) || looksLikeCsv(bodyText))
  const canPreviewBody =
    isEntityBody || isHtmlBody || isJsonBody || isCsvBody || isPrivateBinaryBody

  const htmlSrcDoc = useMemo(() => {
    if (!response || !isHtmlBody) return ''
    return htmlPreviewDocument(bodyText, response.url)
  }, [bodyText, isHtmlBody, response])

  const selectionTabTitle =
    detected?.kind === 'entitysel' && detected.dataClass
      ? t('httpClient.selectionTabTitle', { name: detected.dataClass })
      : undefined

  if (!response) {
    return (
      <EmptyPanel
        icon={Inbox}
        badgeIcon={Send}
        badgeTone="primary"
        title={t('httpClient.responseEmptyTitle')}
        description={t('httpClient.responseEmpty')}
        ghost="cards"
        bordered
        size="lg"
        className="h-full min-h-0 flex-1"
        chips={[
          { icon: FileJson, label: t('httpClient.responseBody'), tone: 'primary' },
          { icon: TableProperties, label: t('httpClient.responseHeaders'), tone: 'cyan' },
          { icon: Cookie, label: t('httpClient.responseCookies'), tone: 'amber' },
        ]}
      />
    )
  }

  const failed = Boolean(response.error) || (response.status > 0 && response.status >= 400)
  const headerEntries = Object.entries(response.headers)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {response.error ? (
          <span className="rounded bg-destructive/15 px-2 py-0.5 font-semibold text-destructive text-xs">
            {t('httpClient.error')}
          </span>
        ) : (
          <span
            className={cn(
              'rounded px-2 py-0.5 font-semibold text-xs tabular-nums',
              failed
                ? 'bg-destructive/15 text-destructive'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            )}
          >
            {response.status} {response.statusText}
          </span>
        )}
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
          {response.durationMs.toFixed(0)} ms
        </span>
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
          {formatByteSize(response.sizeBytes)}
        </span>
        {response.contentType ? (
          <span className="max-w-55 truncate rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {response.contentType}
          </span>
        ) : null}
      </div>

      <div className="mb-2 flex min-h-8 items-end gap-1 border-b pr-1">
        {(
          [
            ['body', t('httpClient.responseBody')],
            ['headers', t('httpClient.responseHeaders')],
            ['cookies', t('httpClient.responseCookies')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              '-mb-px cursor-pointer border-b-2 px-3 py-1.5 font-medium text-xs transition-colors',
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'headers' ? ` (${headerEntries.length})` : null}
            {id === 'cookies' ? ` (${response.cookies.length})` : null}
          </button>
        ))}
        <div className="flex-1" />
        <div className="mb-1 flex h-6 shrink-0 items-center gap-1.5">
          {tab === 'body' && (bodyText || response.error) && !isBinaryBody ? (
            <ClickToCopy
              value={response.error ? formatResponseBody(response) : (bodyText ?? '')}
              tooltipLabel={t('common.clickToCopy')}
              tooltipCopiedLabel={t('common.copied')}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border bg-background px-2 text-[11px] text-muted-foreground leading-none hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-3 w-3 shrink-0" />
              {t('httpClient.copy')}
            </ClickToCopy>
          ) : null}
          {tab === 'body' && canPreviewBody ? (
            <div className="inline-flex h-6 shrink-0 items-stretch overflow-hidden rounded-sm border p-px">
              {(
                [
                  ['preview', t('httpClient.responsePreview')],
                  ['raw', t('httpClient.raw')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'inline-flex h-5 cursor-pointer items-center px-2 text-[11px] leading-none transition-colors',
                    bodyView === id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setBodyView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'body' ? (
          response.error ? (
            <HttpResponseErrorBody response={response} className="h-full" />
          ) : isBinaryBody ? (
            <HttpResponseBinaryBody response={response} className="h-full p-1" />
          ) : isEntityBody && bodyView === 'preview' && detected ? (
            <div className="flex h-full min-h-0 flex-col">
              <ResultPanel result={detected} selectionTabTitle={selectionTabTitle} />
            </div>
          ) : isPrivateBinaryBody && bodyView === 'preview' && privateBinaryValue ? (
            <PrivateBinaryResult value={privateBinaryValue} showJsonToggle={false} />
          ) : isJsonBody && bodyView === 'preview' ? (
            <JsonTreePreview value={response.bodyJson} />
          ) : isCsvBody && bodyView === 'preview' ? (
            <TextPreviewPanel
              text={bodyText}
              baseUrl={response.url}
              initialMode="csv"
              className="h-full border-0"
            />
          ) : isHtmlBody && bodyView === 'preview' ? (
            <HttpPreviewStage
              kind="html"
              url={response.url}
              badge={t('httpClient.previewStageHtml')}
              className="h-full"
            >
              <iframe
                title={t('httpClient.htmlPreviewAlt')}
                srcDoc={htmlSrcDoc}
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                className="h-full w-full border-0 bg-white"
              />
            </HttpPreviewStage>
          ) : (
            <CodeEditor
              value={bodyText}
              language={language}
              readOnly
              height="100%"
              showLineNumbers
              toolbar
              editorPrefs={editorPrefs}
              onEditorPrefsChange={updateEditorPrefs}
              path={`http-client-response://${response.url}`}
            />
          )
        ) : null}

        {tab === 'headers' ? (
          headerEntries.length === 0 ? (
            <EmptyPanel
              icon={TableProperties}
              badgeLabel="0"
              badgeTone="muted"
              title={t('httpClient.noHeadersTitle')}
              description={t('httpClient.noHeaders')}
              ghost="rows"
              bordered
              size="sm"
              className="h-full"
            />
          ) : (
            <div className="h-full overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="w-64 min-w-56 px-3 py-2 font-medium">{t('httpClient.key')}</th>
                    <th className="px-3 py-2 font-medium">{t('httpClient.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {headerEntries.map(([key, value]) => (
                    <tr key={key} className="border-t">
                      <td className="w-64 min-w-56 whitespace-nowrap px-3 py-1.5 align-top font-mono">
                        {key}
                      </td>
                      <td className="break-all px-3 py-1.5 align-top font-mono">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === 'cookies' ? (
          response.cookies.length === 0 ? (
            <EmptyPanel
              icon={Cookie}
              badgeLabel="0"
              badgeTone="muted"
              title={t('httpClient.noCookiesTitle')}
              description={t('httpClient.noCookies')}
              ghost="rows"
              bordered
              size="sm"
              className="h-full"
            />
          ) : (
            <div className="h-full overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('httpClient.name')}</th>
                    <th className="px-3 py-2 font-medium">{t('httpClient.value')}</th>
                    <th className="px-3 py-2 font-medium">{t('httpClient.raw')}</th>
                  </tr>
                </thead>
                <tbody>
                  {response.cookies.map((cookie) => (
                    <tr key={`${cookie.name}-${cookie.raw}`} className="border-t">
                      <td className="px-3 py-1.5 align-top font-mono">{cookie.name}</td>
                      <td className="break-all px-3 py-1.5 align-top font-mono">{cookie.value}</td>
                      <td className="break-all px-3 py-1.5 align-top font-mono text-muted-foreground">
                        {cookie.raw}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}
