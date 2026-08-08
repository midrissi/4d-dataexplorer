import { ClickToCopy } from '@4d/ui'
import { ChevronDown, ChevronRight, Copy, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getIntlLocale, useTranslation } from '~/i18n'
import {
  formatMetadataValue,
  getMetadataIcon,
  prettyMetadataLabel,
} from '~/lib/entity-viewer/metadata'

export function MetadataPanel({
  entries,
  expandAll,
}: {
  entries: [string, unknown][]
  expandAll?: boolean
}) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  const [isExpanded, setIsExpanded] = useState(expandAll ?? false)

  useEffect(() => {
    if (expandAll !== undefined) {
      setIsExpanded(expandAll)
    }
  }, [expandAll])

  if (entries.length === 0) return null

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-dashed bg-muted/30">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t('entity.systemMetadata')}
        </span>
        <span className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {entries.length}
        </span>
      </button>

      {isExpanded && (
        <div className="grid grid-cols-1 gap-1.5 px-3 pt-1 pb-3 sm:grid-cols-2">
          {entries.map(([key, value]) => {
            const Icon = getMetadataIcon(key)
            const display = formatMetadataValue(value, locale)
            return (
              <div
                key={key}
                className="group flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-[10px] text-muted-foreground uppercase">
                    {prettyMetadataLabel(key)}
                  </span>
                  <span className="truncate font-medium text-foreground text-xs" title={display}>
                    {display}
                  </span>
                </div>
                <ClickToCopy
                  value={typeof value === 'string' ? value : JSON.stringify(value)}
                  tooltipLabel={t('common.clickToCopy')}
                  tooltipCopiedLabel={t('common.copied')}
                  className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </ClickToCopy>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
