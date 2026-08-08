import { EMPTY_VALUE, formatValue } from '@4d/rest'
import { Value } from '@4d/ui'
import { FileText } from 'lucide-react'
import { DownloadableImage } from '~/components/DownloadableImage'
import { getIntlLocale, useTranslation } from '~/i18n'
import { getDeferredBlobUrl, getDeferredRelation } from '~/lib/entity-viewer/deferred'
import { getImageUri } from '~/lib/fieldPaths'

export function RelationCellValue({ value }: { value: unknown }) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)

  if (value === null || value === undefined) return <Value.Null />

  // Photo / picture field (deferred image relation) — render the actual image.
  const imageUrl = getImageUri(value)
  if (imageUrl) {
    return (
      <DownloadableImage
        src={imageUrl}
        name="image"
        compact
        imgClassName="max-h-32 max-w-full rounded object-contain"
      />
    )
  }

  // Deferred BLOB (downloadable binary) — render a compact download link.
  const blobUrl = getDeferredBlobUrl(value)
  if (blobUrl) {
    return (
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-primary text-xs underline-offset-2 hover:underline"
        title={t('common.openInNewTab')}
      >
        <FileText className="h-3.5 w-3.5" />
        {t('entity.downloadBlob')}
      </a>
    )
  }

  // Nested deferred relation — show a compact relation marker rather than JSON.
  if (getDeferredRelation(value)) {
    return <span className="font-mono text-muted-foreground text-xs">→</span>
  }
  if (Array.isArray(value)) {
    return <span className="font-mono text-muted-foreground text-xs">[{value.length}]</span>
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-muted-foreground text-xs">{'{…}'}</span>
  }
  if (typeof value === 'boolean') return <Value.Boolean value={value} />

  const formatted = formatValue(value, locale)
  if (formatted === EMPTY_VALUE) return <Value.Null />
  return <span className="text-foreground">{formatted}</span>
}
