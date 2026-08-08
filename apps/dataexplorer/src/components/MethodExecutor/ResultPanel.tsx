import { cn } from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import { FlaskConical, Play, TableProperties } from 'lucide-react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { HttpResponseKeyValueList } from '~/components/HttpClient/HttpResponseKeyValueList'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
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
  selectionTabTitle,
}: {
  result: DetectedMethodResult | null
  rawBody?: unknown
  responseMeta?: MethodResponseMeta | null
  selectionTabTitle?: string
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { tab, setTab, bodyView, setBodyView } = useResultPanelView(result)

  if (!result) {
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
        {tab === 'body' ? (
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'body' ? (
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
