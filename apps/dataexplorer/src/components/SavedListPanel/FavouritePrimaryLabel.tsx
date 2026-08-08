import type { ReactNode } from 'react'

/** Named favourite primary line: custom name + muted technical path. */
export function FavouritePrimaryLabel({ name, detail }: { name?: string; detail: ReactNode }) {
  if (!name) return <>{detail}</>
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 font-medium font-sans text-[11px] text-foreground">{name}</span>
      <span className="min-w-0 truncate text-muted-foreground/80">{detail}</span>
    </span>
  )
}
