import { Button } from '@4d/ui'
import { Eye, Loader2 } from 'lucide-react'
import { TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { useTranslation } from '~/i18n'
import { type EntityIoFormatId, getEntityIoFormat } from '~/lib/entity-io'
import { previewModeForFormat } from './anonymize-dialog-helpers'
import { EntityIoPanel } from './EntityIoPanel'

export function EntityAnonymizePreviewPanel({
  previewCount,
  previewText,
  formatId,
  hasEntitySet,
  loading,
  onRefresh,
}: {
  previewCount: number
  previewText: string
  formatId: EntityIoFormatId
  hasEntitySet: boolean
  loading: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()

  return (
    <EntityIoPanel
      icon={Eye}
      title={t('entity.io.preview')}
      count={previewCount}
      contentClassName="p-0"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          disabled={!hasEntitySet || loading}
          onClick={onRefresh}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t('entity.analyze.refresh')}
        </Button>
      }
    >
      {previewText ? (
        <TextPreviewPanel
          text={previewText}
          className="h-56 rounded-none border-0"
          initialMode={previewModeForFormat(formatId)}
          language={getEntityIoFormat(formatId)?.language}
        />
      ) : (
        <p className="p-2 text-muted-foreground text-xs">{t('entity.io.anonymizeNoPreview')}</p>
      )}
    </EntityIoPanel>
  )
}
