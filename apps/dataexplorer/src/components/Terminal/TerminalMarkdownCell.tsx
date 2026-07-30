import { cn, Markdown } from '@4d/ui'

/**
 * Renders terminal help (or other markdown system output) at terminal density.
 */
export function TerminalMarkdownCell({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'min-w-0 flex-1 overflow-auto rounded-md border border-border/60 bg-muted/15 px-2.5 py-1.5',
        className
      )}
    >
      <Markdown density="compact">{markdown}</Markdown>
    </div>
  )
}
