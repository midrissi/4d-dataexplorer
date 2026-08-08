import type { ReactNode } from 'react'
import { DeferredImage } from '~/components/DeferredImage'
import { getImageUri } from '~/lib/fieldPaths'
import { prettyJson } from './pretty-json'

export function PreviewCell({ value }: { value: unknown }): ReactNode {
  if (getImageUri(value)) {
    return <DeferredImage value={value} className="h-6 w-6 rounded-sm object-cover" />
  }
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/70">—</span>
  }
  if (typeof value === 'object') {
    return (
      <span className="truncate font-mono text-[11px] text-foreground/90" title={prettyJson(value)}>
        {prettyJson(value)}
      </span>
    )
  }
  const text = String(value)
  return (
    <span className="truncate font-mono text-[11px] text-foreground/90" title={text}>
      {text}
    </span>
  )
}
