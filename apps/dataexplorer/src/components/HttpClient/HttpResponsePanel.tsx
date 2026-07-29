import { ClickToCopy, CodeEditor, cn } from '@4d/ui'
import { Cookie, Copy, FileJson, Inbox, Send, TableProperties } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import { PrivateBinaryResult } from '~/components/DecodedBinary/PrivateBinaryResult'
import { EmptyPanel } from '~/components/EmptyPanel'
import { HttpPreviewStage } from '~/components/HttpClient/HttpPreviewStage'
import { HttpResponseBinaryBody } from '~/components/HttpClient/HttpResponseBinaryBody'
import { HttpResponseErrorBody } from '~/components/HttpClient/HttpResponseErrorBody'
import { HttpResponseKeyValueList } from '~/components/HttpClient/HttpResponseKeyValueList'
import { HttpResponseStatusBar } from '~/components/HttpClient/HttpResponseStatusBar'
import { JsonTreePreview, TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { detectMethodResult } from '~/components/MethodExecutor/detect-method-result'
import { ResultPanel } from '~/components/MethodExecutor/ResultPanel'
import { useTranslation } from '~/i18n'
import { isCsvContentType, looksLikeCsv } from '~/lib/csv'
import {
  formatResponseBody,
  monacoLanguageForRaw,
  rawLanguageFromContentType,
} from '~/lib/http-client'
import { isMobileShell } from '~/lib/platform'
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
  const mobile = isMobileShell()
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

  const headerEntries = Object.entries(response.headers)
  const tabItems = [
    { id: 'body' as const, label: t('httpClient.responseBody') },
    {
      id: 'headers' as const,
      label: `${t('httpClient.responseHeaders')} (${headerEntries.length})`,
    },
    {
      id: 'cookies' as const,
      label: `${t('httpClient.responseCookies')} (${response.cookies.length})`,
    },
  ]

  const bodyActions = (
    <>
      {tab === 'body' && (bodyText || response.error) && !isBinaryBody ? (
        <ClickToCopy
          value={response.error ? formatResponseBody(response) : (bodyText ?? '')}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            mobile
              ? 'h-11 min-w-0 flex-1 justify-center rounded-lg px-3 text-sm'
              : 'h-6 gap-1 rounded-sm px-2 text-[11px] leading-none'
          )}
        >
          <Copy className={mobile ? 'h-4 w-4 shrink-0' : 'h-3 w-3 shrink-0'} aria-hidden />
          {t('httpClient.copy')}
        </ClickToCopy>
      ) : null}
      {tab === 'body' && canPreviewBody ? (
        <fieldset
          className={cn(
            'm-0 inline-flex shrink-0 items-stretch overflow-hidden border bg-muted/40 p-0.5',
            mobile ? 'min-h-11 flex-1 rounded-lg' : 'h-6 rounded-sm p-px'
          )}
        >
          <legend className="sr-only">{t('httpClient.bodyViewAria')}</legend>
          {(
            [
              ['preview', t('httpClient.responsePreview')],
              ['raw', t('httpClient.raw')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={bodyView === id}
              className={cn(
                'inline-flex flex-1 cursor-pointer items-center justify-center border-0 bg-transparent font-medium transition-colors',
                mobile ? 'min-h-10 rounded-md px-3 text-sm' : 'h-5 px-2 text-[11px] leading-none',
                bodyView === id
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setBodyView(id)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      ) : null}
    </>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn(mobile ? 'mb-4' : 'mb-3')}>
        <HttpResponseStatusBar response={response} />
      </div>

      {mobile ? (
        <div className="mb-3 space-y-2.5">
          <div
            className="flex gap-1 overflow-x-auto overscroll-x-contain border-border/60 border-b pb-px"
            role="tablist"
            aria-label={t('httpClient.responseTabsAria')}
          >
            {tabItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={cn(
                  'min-h-11 shrink-0 cursor-pointer border-b-2 px-3.5 font-medium text-sm transition-colors',
                  tab === item.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground'
                )}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'body' && (canPreviewBody || bodyText || response.error) ? (
            <div className="flex gap-2">{bodyActions}</div>
          ) : null}
        </div>
      ) : (
        <div className="mb-2 flex min-h-8 items-end gap-1 border-b pr-1">
          {tabItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                '-mb-px cursor-pointer border-b-2 px-3 py-1.5 font-medium text-xs transition-colors',
                tab === item.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="mb-1 flex h-6 shrink-0 items-center gap-1.5">{bodyActions}</div>
        </div>
      )}

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
          <HttpResponseKeyValueList
            entries={headerEntries.map(([key, value]) => ({ key, value }))}
            keyLabel={t('httpClient.key')}
            valueLabel={t('httpClient.value')}
            empty={
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
            }
          />
        ) : null}

        {tab === 'cookies' ? (
          <HttpResponseKeyValueList
            entries={response.cookies.map((cookie) => ({
              key: cookie.name,
              value: cookie.value,
              meta: cookie.raw,
            }))}
            keyLabel={t('httpClient.name')}
            valueLabel={t('httpClient.value')}
            metaLabel={t('httpClient.raw')}
            empty={
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
            }
          />
        ) : null}
      </div>
    </div>
  )
}
