import { FolderOpen, RefreshCw, Sparkles } from 'lucide-react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

type EmptyStateProps = {
  onRetry: () => void
}

export function EmptyState({ onRetry }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div
      className={
        isMobileShell()
          ? 'flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-background px-4 pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)]'
          : 'flex h-screen w-full flex-col items-center justify-center bg-background'
      }
    >
      {' '}
      <EmptyPanel
        icon={FolderOpen}
        badgeIcon={Sparkles}
        badgeTone="primary"
        title={t('emptyState.title')}
        description={t('emptyState.description')}
        ghost="cards"
        bordered
        size="md"
        className="mx-4 max-w-md flex-none"
        action={
          <EmptyPanelAction icon={RefreshCw} onClick={onRetry}>
            {t('emptyState.retry')}
          </EmptyPanelAction>
        }
      >
        <div className="mt-3 w-full max-w-sm rounded-md border border-border bg-muted/30 p-2.5 text-left">
          <p className="mb-2 font-medium text-xs">{t('emptyState.howToExpose')}</p>
          <ol className="space-y-1.5 text-muted-foreground text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-primary">1.</span>
              <span>{t('emptyState.step1')}</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary">2.</span>
              <span>{t('emptyState.step2')}</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary">3.</span>
              <span>{t('emptyState.step3')}</span>
            </li>
          </ol>
        </div>
      </EmptyPanel>
    </div>
  )
}
