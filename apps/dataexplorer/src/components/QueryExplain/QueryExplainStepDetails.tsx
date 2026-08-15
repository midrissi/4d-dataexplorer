import { useTranslation } from '~/i18n'
import {
  displayExplainAttribute,
  formatExplainIdentifier,
} from '~/lib/query-explain/parse-description'
import type { QueryExplainNode } from '~/lib/query-explain/types'
import { QueryExplainAccessBadge } from './QueryExplainAccessBadge'
import { QueryExplainExpr } from './QueryExplainExpr'

export function QueryExplainStepDetails({ node }: { node: QueryExplainNode }) {
  const { t } = useTranslation()
  const joinOn = node.joinOn
  const predicate = node.predicate
  const showTitle = node.access === 'join' || node.access === 'index' || node.access === 'sequential'
  const showRawLabel = !joinOn && !predicate && node.access === 'unknown'
  const showWhereLabel = Boolean(predicate && node.access !== 'filter' && (showTitle || joinOn))
  const predicateLeft = predicate
    ? displayExplainAttribute(predicate.attribute, node.table)
    : ''
  const hasExpr = Boolean(joinOn || predicate || showRawLabel)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      <QueryExplainAccessBadge access={node.access} label={node.title} />
      {showTitle ? (
        <span className="shrink-0 font-medium text-[11px] text-foreground" translate="no">
          {node.title}
        </span>
      ) : null}
      {showTitle && hasExpr ? (
        <span className="shrink-0 text-muted-foreground/35" aria-hidden>
          ·
        </span>
      ) : null}
      {joinOn ? (
        <QueryExplainExpr
          left={formatExplainIdentifier(joinOn.left)}
          operator="="
          right={formatExplainIdentifier(joinOn.right)}
        />
      ) : null}
      {showWhereLabel ? (
        <span className="shrink-0 font-medium text-[9px] text-muted-foreground uppercase tracking-wide">
          {t('queryExplain.where')}
        </span>
      ) : null}
      {predicate ? (
        <QueryExplainExpr
          left={predicateLeft}
          operator={predicate.operator}
          right={formatExplainIdentifier(predicate.value)}
        />
      ) : null}
      {showRawLabel ? (
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" translate="no">
          {node.label}
        </span>
      ) : null}
    </div>
  )
}
