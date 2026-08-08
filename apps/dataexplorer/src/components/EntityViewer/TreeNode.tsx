import { EMPTY_VALUE, formatDate, formatDuration, formatNumber } from '@4d/rest'
import { Button, ClickToCopy, Value } from '@4d/ui'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  BinaryObjectViewer,
  isPrivateBinaryObject,
  PRIVATE_BINARY_OBJECT_KEY,
} from '~/components/BinaryObjectViewer'
import { DownloadableImage } from '~/components/DownloadableImage'
import { getIntlLocale, useTranslation } from '~/i18n'
import { getDeferredBlobUrl, getDeferredRelation } from '~/lib/entity-viewer/deferred'
import {
  isDateStringPattern,
  isDurationFieldName,
  looksLikeDurationNumber,
} from '~/lib/entity-viewer/tree-value'
import { getImageUri } from '~/lib/fieldPaths'
import { DeferredRelation } from './DeferredRelation'

export function TreeNode({
  keyName,
  value,
  depth = 0,
  expandAll,
}: {
  keyName: string | number
  value: unknown
  depth?: number
  expandAll?: boolean
}) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  const [isExpanded, setIsExpanded] = useState(expandAll ?? false)

  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)

  // React to expandAll changes
  useEffect(() => {
    if (expandAll !== undefined) {
      setIsExpanded(expandAll)
    }
  }, [expandAll])

  const renderValue = () => {
    if (value === null || value === undefined) {
      return <Value.Null />
    }
    if (typeof value === 'boolean') {
      return <Value.Boolean value={value} />
    }
    if (typeof value === 'number') {
      if (isDurationFieldName(keyName) && looksLikeDurationNumber(value)) {
        return <Value.Duration value={value} formatter={formatDuration} />
      }
      return <Value.Number value={value} formatter={formatNumber} />
    }
    if (typeof value === 'string') {
      if (isDateStringPattern(value)) {
        const formatted = formatDate(value, undefined, locale)
        // Only show as date if it was successfully formatted (not the raw value)
        if (formatted !== value && formatted !== EMPTY_VALUE) {
          return <Value.Date value={formatted} />
        }
        // If it's a null date (!!0000-00-00!!), show null tag
        if (formatted === EMPTY_VALUE) {
          return <Value.Null />
        }
      }
      // Check if it's a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return <Value.Url value={value} truncate={50} />
      }
      // Long strings
      if (value.length > 100) {
        return (
          <span className="text-green-600 text-sm dark:text-green-400">
            "{value.slice(0, 100)}..."
          </span>
        )
      }
      return <span className="text-green-600 text-sm dark:text-green-400">"{value}"</span>
    }
    return <span className="text-sm">{String(value)}</span>
  }

  if (!isObject) {
    return (
      <div className="group flex items-start gap-2 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}:</span>
        {renderValue()}
        <ClickToCopy
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </ClickToCopy>
      </div>
    )
  }

  // 4D private binary object (blob/picture serialised as base64) — render a
  // dedicated, expandable viewer instead of the generic object tree.
  if (isPrivateBinaryObject(value)) {
    return (
      <div className="space-y-1 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}</span>
        <BinaryObjectViewer base64={value[PRIVATE_BINARY_OBJECT_KEY]} name={String(keyName)} />
      </div>
    )
  }

  // Photo / picture field (deferred image relation) — render the actual image.
  const imageUrl = getImageUri(value)
  if (imageUrl) {
    return (
      <div className="space-y-1 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}</span>
        <DownloadableImage
          src={imageUrl}
          alt={String(keyName)}
          name={String(keyName)}
          imgClassName="max-h-48 max-w-full rounded object-contain"
        />
      </div>
    )
  }

  // Deferred BLOB (downloadable binary) — render the binary viewer so the value
  // can be inspected, previewed and downloaded, not just linked.
  const blobUrl = getDeferredBlobUrl(value)
  if (blobUrl) {
    return (
      <div className="space-y-1 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}</span>
        <BinaryObjectViewer url={blobUrl} name={String(keyName)} />
      </div>
    )
  }

  // Deferred relation (related entity or entity set) — load asynchronously.
  const deferredRel = getDeferredRelation(value)
  if (deferredRel) {
    return (
      <DeferredRelation
        name={keyName}
        uri={deferredRel.uri}
        kind={deferredRel.key != null ? 'relatedEntity' : 'relatedEntities'}
      />
    )
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i, v] as const)
    : Object.entries(value as Record<string, unknown>)

  return (
    <div>
      {/* Toggle button */}
      <div className="group flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto gap-1.5 rounded py-0.5 pr-2"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{keyName}</span>
          <span className="rounded-full border px-2 py-0.5 font-mono text-muted-foreground text-xs">
            {isArray ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        </Button>
        <ClickToCopy
          value={JSON.stringify(value, null, 2)}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </ClickToCopy>
      </div>

      {/* Children */}
      {isExpanded && (
        <div className="ml-2 border-border/40 border-l pl-4">
          {entries.map(([k, v]) => (
            <TreeNode
              key={String(k)}
              keyName={k}
              value={v}
              depth={depth + 1}
              expandAll={expandAll}
            />
          ))}
          {entries.length === 0 && (
            <p className="py-1 text-muted-foreground text-sm italic">
              {isArray ? t('entity.emptyArray') : t('entity.emptyObject')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
