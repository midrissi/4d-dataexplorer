import { cn } from '@4d/ui'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { QueryExplainNode } from '~/lib/query-explain/types'
import { QueryExplainStepDetails } from './QueryExplainStepDetails'
import { QueryExplainStepMeta } from './QueryExplainStepMeta'
import { queryExplainAccentClass, queryExplainRailClass } from './query-explain-display'

export function QueryExplainTreeRow({
  node,
  defaultOpen = true,
}: {
  node: QueryExplainNode
  defaultOpen?: boolean
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = node.children.length > 0

  const gutter = hasChildren ? (
    <ChevronRight
      className={cn(
        'size-3 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
        open && 'rotate-90'
      )}
      aria-hidden
    />
  ) : (
    <span className="inline-flex size-3 shrink-0 items-center justify-center" aria-hidden>
      <span className={cn('size-1 rounded-full', queryExplainAccentClass(node.access))} />
    </span>
  )

  const rowClass = cn(
    'flex w-full min-w-0 items-center gap-1 rounded-sm py-px pr-1 text-left hover:bg-muted/40',
    mobile && 'min-h-11 py-1'
  )

  return (
    <li className="list-none">
      <div className="flex items-center gap-1">
        {hasChildren ? (
          <button
            type="button"
            className={cn(
              rowClass,
              'focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
            aria-expanded={open}
            title={open ? t('queryExplain.collapseStep') : t('queryExplain.expandStep')}
            onClick={() => setOpen((current) => !current)}
          >
            {gutter}
            <QueryExplainStepDetails node={node} />
            <QueryExplainStepMeta timeMs={node.timeMs} recordsFound={node.recordsFound} />
          </button>
        ) : (
          <div className={rowClass}>
            {gutter}
            <QueryExplainStepDetails node={node} />
            <QueryExplainStepMeta timeMs={node.timeMs} recordsFound={node.recordsFound} />
          </div>
        )}
      </div>
      {hasChildren && open ? (
        <ul className={cn('m-0 ml-1.5 border-l py-0 pl-1.5', queryExplainRailClass(node.access))}>
          {node.children.map((child) => (
            <QueryExplainTreeRow key={child.id} node={child} defaultOpen={defaultOpen} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
