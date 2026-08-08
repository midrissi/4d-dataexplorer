import { cn } from '@4d/ui'
import { History } from 'lucide-react'
import {
  formatRelativeTime,
  SavedListBadge,
  SavedListPanel,
  SavedListRow,
} from '~/components/SavedListPanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { MethodExecutorSeed } from '~/store/method-executor-types'
import { useMethodFavouritesStore } from '~/store/method-favourites'
import type { MethodRunHistoryItem } from '~/store/method-run-history'
import { MethodSeedExpression } from './MethodSeedExpression'
import {
  cnMethodScopeBadge,
  methodArgCountMeta,
  methodResultAccentClass,
  methodScopeShortLabel,
} from './method-list-display'

function HistoryRunRow({
  run,
  onOpen,
  onRemove,
}: {
  run: MethodRunHistoryItem
  onOpen: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const isFavourite = useMethodFavouritesStore((state) => state.isFavourite(run.config))
  const toggleFavourite = useMethodFavouritesStore((state) => state.toggleFavourite)
  const argCount = run.config.arguments?.length ?? 0
  const argMeta = methodArgCountMeta(argCount, t)
  const absoluteTime = new Date(run.timestamp).toLocaleString()

  return (
    <SavedListRow
      accentClassName={methodResultAccentClass(run.resultKind)}
      badge={
        <SavedListBadge className={cn(cnMethodScopeBadge(run.config.scope), 'normal-case')}>
          {methodScopeShortLabel(run.config.scope)}
        </SavedListBadge>
      }
      primary={<MethodSeedExpression config={run.config} />}
      meta={
        <>
          {argMeta ? (
            <span className="hidden text-[10px] text-muted-foreground sm:inline">{argMeta}</span>
          ) : null}
          {!mobile ? (
            <span
              className="w-14 truncate text-right text-[10px] text-muted-foreground/80 tabular-nums"
              title={absoluteTime}
            >
              {formatRelativeTime(run.timestamp)}
            </span>
          ) : null}
        </>
      }
      favourite={{
        active: isFavourite,
        onToggle: () => toggleFavourite(run.config),
        addLabel: t('methodExecutor.addFavourite'),
        removeLabel: t('methodExecutor.removeFavourite'),
      }}
      onRemove={onRemove}
      removeLabel={t('methodExecutor.removeRun')}
      onOpen={onOpen}
    />
  )
}

export function MethodRunHistory({
  runs,
  onOpenRun,
  onRemoveRun,
  onClearRuns,
  onClose,
}: {
  runs: MethodRunHistoryItem[]
  onOpenRun: (config: MethodExecutorSeed) => void
  onRemoveRun: (id: string) => void
  onClearRuns: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()

  return (
    <SavedListPanel
      icon={History}
      title={t('methodExecutor.lastRuns')}
      titleId={mobile ? 'method-run-history-title' : undefined}
      count={runs.length}
      clearLabel={t('methodExecutor.clearAll')}
      onClear={onClearRuns}
      clearConfirm={{
        title: t('methodExecutor.clearHistoryTitle'),
        description: t('methodExecutor.clearHistoryDescription'),
        confirmText: t('methodExecutor.clearAll'),
        cancelText: t('methodExecutor.cancel'),
      }}
      emptyTitle={t('methodExecutor.noRunsTitle')}
      emptyDescription={t('methodExecutor.noRunsDescription')}
      onClose={onClose}
    >
      {runs.map((run) => (
        <HistoryRunRow
          key={run.id}
          run={run}
          onOpen={() => onOpenRun(run.config)}
          onRemove={() => onRemoveRun(run.id)}
        />
      ))}
    </SavedListPanel>
  )
}
