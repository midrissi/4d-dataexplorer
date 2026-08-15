import { cn } from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import { Code2, FlaskConical, MousePointerClick, Play, TableProperties } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { HttpResponseErrorBody } from '~/components/HttpClient/HttpResponseErrorBody'
import { HttpResponseKeyValueList } from '~/components/HttpClient/HttpResponseKeyValueList'
import { HttpResponseStatusBar } from '~/components/HttpClient/HttpResponseStatusBar'
import { QueryExplainPanel } from '~/components/QueryExplain/QueryExplainPanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { extractQueryExplain, queryExplainHasData } from '~/lib/query-explain/extract'
import type { HttpClientResponse } from '~/store/http-client-types'
import type { DetectedMethodResult } from './detect-method-result'
import { MethodResponseStatusBar } from './MethodResponseStatusBar'
import { headerEntriesFromMeta, type MethodResponseMeta } from './method-response-meta'
import { PreviewBody } from './PreviewBody'
import { prettyJson } from './pretty-json'
import { useResultPanelView } from './use-result-panel-view'

export function ResultPanel({
  result,
  rawBody,
  responseMeta,
  errorResponse,
  methodSelected = true,
  selectionTabTitle,
}: {
  result: DetectedMethodResult | null
  rawBody?: unknown
  responseMeta?: MethodResponseMeta | null
  /** When set, replaces the success result (same error UI as HTTP Client). */
  errorResponse?: HttpClientResponse | null
  /** False until the user picks a method — changes the empty-state copy. */
  methodSelected?: boolean
  selectionTabTitle?: string
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { tab, setTab, bodyView, setBodyView } = useResultPanelView(result, errorResponse)
  const explainPayload = useMemo(() => extractQueryExplain(rawBody, true), [rawBody])
  const showExplainTab = queryExplainHasData(explainPayload)
  const resolvedTab = tab === 'explain' && !showExplainTab ? 'body' : tab

  if (errorResponse) {
    const headerEntries = Object.entries(errorResponse.headers).map(([key, value]) => ({
      key,
      value,
    }))
    const tabItems = [
      { id: 'body' as const, label: t('httpClient.responseBody') },
      {
        id: 'headers' as const,
        label: `${t('httpClient.responseHeaders')} (${headerEntries.length})`,
      },
    ]

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className={cn('shrink-0', mobile ? 'mb-2' : 'mb-3')}>
          <HttpResponseStatusBar response={errorResponse} />
        </div>
        <div
          className={cn(
            'mb-2 flex min-h-8 items-end gap-1 border-b',
            mobile ? 'border-border/60 pb-px' : 'pr-1'
          )}
        >
          <div
            className={cn(
              'flex min-w-0 flex-1',
              mobile ? 'gap-0.5 overflow-x-auto overscroll-x-contain' : ''
            )}
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
                  'cursor-pointer border-b-2 font-medium text-xs transition-colors',
                  mobile ? 'min-h-9 shrink-0 px-2.5' : '-mb-px px-3 py-1.5',
                  tab === item.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === 'body' ? (
            <HttpResponseErrorBody response={errorResponse} className="h-full" />
          ) : (
            <HttpResponseKeyValueList
              entries={headerEntries}
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
          )}
        </div>
      </div>
    )
  }

  if (!result) {
    if (!methodSelected) {
      return (
        <EmptyPanel
          icon={Code2}
          badgeIcon={MousePointerClick}
          badgeTone="primary"
          title={t('methodExecutor.emptyResultSelectMethodTitle')}
          description={t('methodExecutor.emptyResultSelectMethodDescription')}
          ghost="rows"
          size="lg"
          className="h-full min-h-0"
        />
      )
    }
    return (
      <EmptyPanel
        icon={FlaskConical}
        badgeIcon={Play}
        badgeTone="primary"
        title={t('methodExecutor.emptyResultTitle')}
        description={t('methodExecutor.emptyResultDescription')}
        ghost="rows"
        size="lg"
        className="h-full min-h-0"
      />
    )
  }

  if (!responseMeta) {
    return <PreviewBody result={result} selectionTabTitle={selectionTabTitle} />
  }

  const headerEntries = headerEntriesFromMeta(responseMeta.headers)
  const tabItems = [
    { id: 'body' as const, label: t('httpClient.responseBody') },
    {
      id: 'headers' as const,
      label: `${t('httpClient.responseHeaders')} (${headerEntries.length})`,
    },
    ...(showExplainTab
      ? [{ id: 'explain' as const, label: t('queryExplain.tab') }]
      : []),
  ]

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className={cn('shrink-0', mobile ? 'mb-2' : 'mb-3')}>
        <MethodResponseStatusBar meta={responseMeta} />
      </div>
      <div
        className={cn(
          'mb-2 flex min-h-8 items-end gap-1 border-b',
          mobile ? 'border-border/60 pb-px' : 'pr-1'
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-1',
            mobile ? 'gap-0.5 overflow-x-auto overscroll-x-contain' : ''
          )}
          role="tablist"
          aria-label={t('httpClient.responseTabsAria')}
        >
          {tabItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={resolvedTab === item.id}
              className={cn(
                'cursor-pointer border-b-2 font-medium text-xs transition-colors',
                mobile ? 'min-h-9 shrink-0 px-2.5' : '-mb-px px-3 py-1.5',
                resolvedTab === item.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {resolvedTab === 'body' ? (
          <fieldset
            className={cn(
              'm-0 mb-1 inline-flex shrink-0 items-stretch overflow-hidden border bg-muted/40 p-0.5',
              mobile ? 'h-9 rounded-md' : 'h-6 rounded-sm p-px'
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
                  'inline-flex cursor-pointer items-center justify-center border-0 bg-transparent font-medium transition-colors',
                  mobile ? 'min-h-8 rounded px-2.5 text-xs' : 'h-5 px-2 text-[11px] leading-none',
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
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {resolvedTab === 'explain' && explainPayload ? (
          <QueryExplainPanel payload={explainPayload} embedded />
        ) : resolvedTab === 'body' ? (
          bodyView === 'raw' ? (
            <CodeEditor
              value={prettyJson(rawBody ?? result.value)}
              readOnly
              height="100%"
              toolbar
            />
          ) : (
            <PreviewBody result={result} selectionTabTitle={selectionTabTitle} />
          )
        ) : (
          <HttpResponseKeyValueList
            entries={headerEntries}
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
        )}
      </div>
    </div>
  )
}
