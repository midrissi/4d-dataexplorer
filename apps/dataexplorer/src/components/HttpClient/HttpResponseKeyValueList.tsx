import { cn } from '@4d/ui'
import type { ReactNode } from 'react'
import { isMobileShell } from '~/lib/platform'

export type HttpResponseKeyValue = {
  key: string
  value: string
  meta?: string
}

type HttpResponseKeyValueListProps = {
  entries: HttpResponseKeyValue[]
  keyLabel: string
  valueLabel: string
  metaLabel?: string
  empty: ReactNode
}

export function HttpResponseKeyValueList({
  entries,
  keyLabel,
  valueLabel,
  metaLabel,
  empty,
}: HttpResponseKeyValueListProps) {
  const mobile = isMobileShell()

  if (entries.length === 0) return <>{empty}</>

  if (mobile) {
    return (
      <ul className="h-full space-y-2 overflow-auto overscroll-contain pr-0.5">
        {entries.map((entry) => (
          <li
            key={`${entry.key}-${entry.meta ?? entry.value}`}
            className="rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3"
          >
            <p className="break-all font-medium font-mono text-foreground text-sm">{entry.key}</p>
            <p className="mt-1.5 break-all font-mono text-muted-foreground text-xs leading-relaxed">
              {entry.value || '—'}
            </p>
            {entry.meta ? (
              <p className="mt-2 break-all border-border/50 border-t pt-2 font-mono text-[11px] text-muted-foreground/80">
                {entry.meta}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }

  const showMeta = Boolean(metaLabel) && entries.some((e) => e.meta)

  return (
    <div className="h-full overflow-auto rounded-md border">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            <th className={cn('px-3 py-2 font-medium', !showMeta && 'w-64 min-w-56')}>
              {keyLabel}
            </th>
            <th className="px-3 py-2 font-medium">{valueLabel}</th>
            {showMeta ? <th className="px-3 py-2 font-medium">{metaLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.key}-${entry.meta ?? entry.value}`} className="border-t">
              <td
                className={cn(
                  'whitespace-nowrap px-3 py-1.5 align-top font-mono',
                  !showMeta && 'w-64 min-w-56'
                )}
              >
                {entry.key}
              </td>
              <td className="break-all px-3 py-1.5 align-top font-mono">{entry.value}</td>
              {showMeta ? (
                <td className="break-all px-3 py-1.5 align-top font-mono text-muted-foreground">
                  {entry.meta}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
