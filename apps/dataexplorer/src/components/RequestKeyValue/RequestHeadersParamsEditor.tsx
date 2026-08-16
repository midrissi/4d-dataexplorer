import { cn } from '@4d/ui'
import { useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  COMMON_REQUEST_HEADERS,
  headerValueSuggestions,
  REST_QUERY_PARAMS,
  restParamValueSuggestions,
} from '~/lib/http-client'
import { isMobileShell } from '~/lib/platform'
import type { HttpKeyValuePair } from '~/store/http-client-types'
import { KeyValueEditor } from './KeyValueEditor'

type RequestKeyValueTab = 'params' | 'headers'

/**
 * Shared Params + Headers editors (same KeyValueEditor as HTTP Client).
 * Does not include HTTP Client–only built-in headers or cookie jar.
 */
export function RequestHeadersParamsEditor({
  params,
  headers,
  onParamsChange,
  onHeadersChange,
  thisRoot,
  className,
  defaultTab = 'params',
}: {
  params: HttpKeyValuePair[]
  headers: HttpKeyValuePair[]
  onParamsChange: (params: HttpKeyValuePair[]) => void
  onHeadersChange: (headers: HttpKeyValuePair[]) => void
  thisRoot?: unknown
  className?: string
  defaultTab?: RequestKeyValueTab
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const [tab, setTab] = useState<RequestKeyValueTab>(defaultTab)

  const enabledParams = params.filter((pair) => pair.enabled && pair.key.trim()).length
  const enabledHeaders = headers.filter((pair) => pair.enabled && pair.key.trim()).length

  const tabs: { id: RequestKeyValueTab; label: string; count?: number }[] = [
    {
      id: 'params',
      label: t('httpClient.params'),
      count: enabledParams || undefined,
    },
    {
      id: 'headers',
      label: t('httpClient.headers'),
      count: enabledHeaders || undefined,
    },
  ]

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className="flex items-center gap-1 overflow-x-auto border-b"
        role="tablist"
        aria-label={`${t('httpClient.params')} / ${t('httpClient.headers')}`}
      >
        {tabs.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                'shrink-0 cursor-pointer whitespace-nowrap border-b-2 text-xs transition-colors',
                mobile ? 'min-h-11 px-3 py-2.5' : 'px-3 py-1.5',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.count ? ` (${item.count})` : null}
            </button>
          )
        })}
      </div>

      <div className="p-2">
        {tab === 'params' ? (
          <KeyValueEditor
            pairs={params}
            onChange={onParamsChange}
            keyPlaceholder={t('httpClient.key')}
            valuePlaceholder={t('httpClient.value')}
            keySuggestions={REST_QUERY_PARAMS}
            getValueSuggestions={restParamValueSuggestions}
            smartParamValues
            thisRoot={thisRoot}
            addLabel={t('httpClient.addParam')}
            emptyTitle={t('httpClient.noParamsTitle')}
            emptyDescription={t('httpClient.noParamsDescription')}
          />
        ) : (
          <KeyValueEditor
            pairs={headers}
            onChange={onHeadersChange}
            keyPlaceholder={t('httpClient.key')}
            valuePlaceholder={t('httpClient.value')}
            keySuggestions={COMMON_REQUEST_HEADERS}
            getValueSuggestions={headerValueSuggestions}
            thisRoot={thisRoot}
            addLabel={t('httpClient.addHeader')}
            emptyTitle={t('httpClient.noHeadersRequestTitle')}
            emptyDescription={t('httpClient.noHeadersRequestDescription')}
          />
        )}
      </div>
    </div>
  )
}
