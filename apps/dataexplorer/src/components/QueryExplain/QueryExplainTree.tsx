import type { QueryExplainNode } from '~/lib/query-explain/types'
import { QueryExplainTreeRow } from './QueryExplainTreeRow'

export function QueryExplainTree({
  root,
  defaultOpen = true,
}: {
  root: QueryExplainNode
  defaultOpen?: boolean
}) {
  return (
    <ul className="m-0 px-1.5 py-0.5">
      <QueryExplainTreeRow node={root} defaultOpen={defaultOpen} />
    </ul>
  )
}
