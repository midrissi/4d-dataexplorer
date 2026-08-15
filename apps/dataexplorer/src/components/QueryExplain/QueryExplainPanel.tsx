import { cn, ScrollArea } from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import { GitBranch, Route } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { queryExplainHasData } from '~/lib/query-explain/extract'
import {
  normalizeQueryPath,
  normalizeQueryPlan,
  summarizeQueryExplain,
} from '~/lib/query-explain/normalize'
import type { QueryExplainPayload } from '~/lib/query-explain/types'
import { useActiveDataclassTab, useTabsStore } from '~/store/tabs'
import { QueryExplainToolbar } from './QueryExplainToolbar'
import { QueryExplainTree } from './QueryExplainTree'

type ExplainTab = 'path' | 'plan'
type ExplainView = 'tree' | 'json'

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function QueryExplainPanel({
  payload,
  className,
  embedded = false,
}: {
  payload: QueryExplainPayload | null
  className?: string
  /** Fill a parent tab (HTTP Client / Method Executor) instead of a collapsible card. */
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const dataclassTab = useActiveDataclassTab()
  const setQueryExplainExpanded = useTabsStore((s) => s.setQueryExplainExpanded)
  const expanded = embedded ? true : (dataclassTab?.queryExplainExpanded ?? false)
  const pathTree = useMemo(
    () => (payload?.path != null ? normalizeQueryPath(payload.path) : null),
    [payload?.path]
  )
  const planTree = useMemo(
    () => (payload?.plan != null ? normalizeQueryPlan(payload.plan) : null),
    [payload?.plan]
  )
  const hasPath = pathTree != null
  const hasPlan = planTree != null
  const [tab, setTab] = useState<ExplainTab>(hasPath ? 'path' : 'plan')
  const [view, setView] = useState<ExplainView>('tree')
  const [viewedPayload, setViewedPayload] = useState(payload)
  const [treeExpanded, setTreeExpanded] = useState(true)
  const [treeEpoch, setTreeEpoch] = useState(0)

  if (payload !== viewedPayload) {
    setViewedPayload(payload)
    setTab(payload?.path != null ? 'path' : 'plan')
    setView('tree')
    setTreeExpanded(true)
    setTreeEpoch((n) => n + 1)
  }

  const activeTab: ExplainTab = tab === 'path' && !hasPath && hasPlan ? 'plan' : tab
  const activeTree = activeTab === 'path' ? pathTree : planTree
  const activeRaw = activeTab === 'path' ? payload?.path : payload?.plan
  const summary = summarizeQueryExplain(activeTree)
  const hasData = queryExplainHasData(payload)

  const tabs: Array<{ id: ExplainTab; label: string; disabled: boolean }> = [
    { id: 'path', label: t('queryExplain.pathTab'), disabled: !hasPath },
    { id: 'plan', label: t('queryExplain.planTab'), disabled: !hasPlan },
  ]

  const toolbar = (
    <QueryExplainToolbar
      title={embedded ? undefined : t('queryExplain.title')}
      stepCount={summary.stepCount}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setTab}
      view={view}
      onViewChange={setView}
      summary={summary}
      copyValue={activeRaw != null ? pretty(activeRaw) : undefined}
      collapsible={!embedded}
      expanded={expanded}
      treeExpanded={treeExpanded}
      onToggleTreeExpanded={
        activeTree && activeTree.children.length > 0
          ? (next) => {
              setTreeExpanded(next)
              setTreeEpoch((n) => n + 1)
            }
          : undefined
      }
      onToggleExpanded={
        dataclassTab ? () => setQueryExplainExpanded(dataclassTab.id, !expanded) : undefined
      }
    />
  )

  const body = !hasData ? (
    <>
      {!embedded ? toolbar : null}
      {expanded ? (
        <div className="p-2">
          <EmptyPanel
            icon={Route}
            badgeIcon={GitBranch}
            badgeTone="muted"
            title={t('queryExplain.emptyTitle')}
            description={t('queryExplain.emptyDescription')}
            ghost="rows"
            bordered={false}
            size={embedded ? 'lg' : 'sm'}
            className={embedded ? 'h-full min-h-0' : undefined}
          />
        </div>
      ) : null}
    </>
  ) : (
    <>
      {toolbar}
      {expanded ? (
        <ScrollArea className={cn('min-h-0 flex-1', embedded ? 'h-full' : 'max-h-64')}>
          {view === 'json' ? (
            <div className="p-2">
              <CodeEditor value={pretty(activeRaw)} readOnly height="240px" toolbar={false} />
            </div>
          ) : activeTree ? (
            <QueryExplainTree
              key={`${activeTab}-${treeEpoch}`}
              root={activeTree}
              defaultOpen={treeExpanded}
            />
          ) : null}
        </ScrollArea>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className={cn('flex h-full min-h-0 flex-col', className)}>{body}</div>
  }

  return (
    <section
      className={cn('flex shrink-0 flex-col border-b', className)}
      aria-label={t('queryExplain.title')}
    >
      {body}
    </section>
  )
}
