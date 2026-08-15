import { cn } from '@4d/ui'

export function QueryExplainExpr({
  left,
  operator,
  right,
  className,
}: {
  left: string
  operator: string
  right: string
  className?: string
}) {
  const title = `${left} ${operator} ${right}`
  return (
    <span
      title={title}
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-sm bg-muted/70 px-1 py-px font-mono text-[10px] text-foreground/90 leading-none',
        className
      )}
    >
      <span className="min-w-0 truncate" translate="no">
        {left}
      </span>
      <span className="shrink-0 text-muted-foreground">{operator}</span>
      <span className="min-w-0 truncate" translate="no">
        {right}
      </span>
    </span>
  )
}
