import { Button, ClickToCopy, cn, SegmentedControl } from '@4d/ui'
import {
  Braces,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  GitBranch,
  Minus,
  Route,
} from 'lucide-react'
import { SavedListMetaPill } from '~/components/SavedListPanel'
import { TriStateIconButton } from '~/components/TriStateIconButton'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { QueryExplainSummary } from '~/lib/query-explain/types'

type ExplainTab = 'path' | 'plan'
type ExplainView = 'tree' | 'json'

export function QueryExplainToolbar({
  title,
  stepCount,
  tabs,
  activeTab,
  onTabChange,
  view,
  onViewChange,
  summary,
  copyValue,
  collapsible = false,
  expanded = true,
  onToggleExpanded,
  treeExpanded = true,
  onToggleTreeExpanded,
}: {
  title?: string
  stepCount?: number
  tabs: Array<{ id: ExplainTab; label: string; disabled: boolean }>
  activeTab: ExplainTab
  onTabChange: (tab: ExplainTab) => void
  view: ExplainView
  onViewChange: (view: ExplainView) => void
  summary: QueryExplainSummary
  copyValue?: string
  collapsible?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
  treeExpanded?: boolean
  onToggleTreeExpanded?: (expanded: boolean) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const enabledTabs = tabs.filter((item) => !item.disabled)
  const showControls = expanded

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-background px-2 py-1',
        expanded && 'border-b',
        mobile && expanded && 'flex-col items-stretch gap-2 px-3 py-2'
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {title && collapsible ? (
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              className={cn('gap-1 px-2 text-xs', mobile ? 'h-9' : 'h-6')}
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              aria-label={expanded ? t('common.collapsePanel') : t('common.expandPanel')}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {title}
            </Button>
            {stepCount != null && stepCount > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {stepCount}
              </span>
            ) : null}
          </div>
        ) : title ? (
          <div className="flex min-w-0 items-center gap-2">
            <Route className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className={cn('font-medium text-xs', mobile && 'text-sm')}>{title}</p>
            {stepCount != null && stepCount > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {stepCount}
              </span>
            ) : null}
          </div>
        ) : null}
        {showControls && enabledTabs.length > 1 ? (
          <SegmentedControl
            aria-label={t('queryExplain.tabsAria')}
            size={mobile ? 'md' : 'sm'}
            value={activeTab}
            onValueChange={onTabChange}
            options={enabledTabs.map((item) => ({ value: item.id, label: item.label }))}
          />
        ) : null}
        <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0">
          <legend className="sr-only">{t('queryExplain.summaryAria')}</legend>
          {summary.timeMs != null ? (
            <SavedListMetaPill className="border-border/60 bg-background/80 text-muted-foreground">
              {t('queryExplain.timeMs', { ms: summary.timeMs })}
            </SavedListMetaPill>
          ) : null}
          {summary.recordsFound != null ? (
            <SavedListMetaPill className="border-border/60 bg-background/80 text-muted-foreground">
              {t('queryExplain.recordsFound', { count: summary.recordsFound })}
            </SavedListMetaPill>
          ) : null}
          {summary.joinCount > 0 ? (
            <SavedListMetaPill className="border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400">
              {t('queryExplain.joinCount', { count: summary.joinCount })}
            </SavedListMetaPill>
          ) : null}
          {summary.sequentialCount > 0 ? (
            <SavedListMetaPill className="border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              {t('queryExplain.sequentialCount', { count: summary.sequentialCount })}
            </SavedListMetaPill>
          ) : null}
          {summary.indexCount > 0 ? (
            <SavedListMetaPill className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {t('queryExplain.indexCount', { count: summary.indexCount })}
            </SavedListMetaPill>
          ) : null}
        </fieldset>
      </div>
      {showControls ? (
        <div className={cn('flex shrink-0 items-center gap-1', mobile && 'justify-end')}>
          <SegmentedControl
            aria-label={t('queryExplain.viewAria')}
            size={mobile ? 'md' : 'sm'}
            value={view}
            onValueChange={onViewChange}
            options={[
              { value: 'tree', label: t('queryExplain.treeView'), icon: GitBranch },
              { value: 'json', label: t('queryExplain.jsonView'), icon: Braces },
            ]}
          />
          {view === 'tree' && onToggleTreeExpanded ? (
            <TriStateIconButton
              appearance="icon"
              state={treeExpanded}
              className={mobile ? 'h-9 w-9' : undefined}
              icons={{
                false: ChevronsUpDown,
                indeterminate: Minus,
                true: ChevronsDownUp,
              }}
              labels={{
                false: t('queryExplain.expandAll'),
                indeterminate: t('queryExplain.expandAll'),
                true: t('queryExplain.collapseAll'),
              }}
              onToggle={onToggleTreeExpanded}
            />
          ) : null}
          {copyValue != null ? (
            <ClickToCopy
              value={copyValue}
              tooltipLabel={t('queryExplain.copyJson')}
              tooltipCopiedLabel={t('common.copied')}
              className={cn(
                'inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground',
                mobile ? 'h-9 w-9' : 'h-6 w-6'
              )}
              aria-label={t('queryExplain.copyJson')}
            >
              <Copy className={mobile ? 'size-4' : 'size-3.5'} />
            </ClickToCopy>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
