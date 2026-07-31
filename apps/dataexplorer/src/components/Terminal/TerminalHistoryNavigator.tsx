import { Button, cn } from '@4d/ui'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  type TerminalHistoryDirection,
  terminalHistoryDirectionFromSwipe,
} from './terminal-history-gesture'

type TerminalHistoryNavigatorProps = {
  count: number
  index: number | null
  onPrevious: () => void
  onNext: () => void
}

export function TerminalHistoryNavigator({
  count,
  index,
  onPrevious,
  onNext,
}: TerminalHistoryNavigatorProps) {
  const { t } = useTranslation()
  const pointerStartY = useRef<number | null>(null)
  const [direction, setDirection] = useState<TerminalHistoryDirection | null>(null)
  const canPrevious = count > 0 && index !== 0
  const canNext = index !== null

  const move = (nextDirection: TerminalHistoryDirection) => {
    if (nextDirection === 'previous' && !canPrevious) return
    if (nextDirection === 'next' && !canNext) return
    setDirection(nextDirection)
    if (nextDirection === 'previous') onPrevious()
    else onNext()
    window.setTimeout(() => setDirection(null), 160)
  }

  return (
    <fieldset
      className="m-0 flex min-h-11 min-w-0 touch-none select-none items-center gap-2 border-0 border-border/50 border-t bg-muted/15 px-2 py-0"
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch') return
        if ((event.target as Element).closest('button')) return
        pointerStartY.current = event.clientY
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={(event) => {
        const startY = pointerStartY.current
        pointerStartY.current = null
        if (startY === null) return
        const nextDirection = terminalHistoryDirectionFromSwipe(startY, event.clientY)
        if (nextDirection) move(nextDirection)
      }}
      onPointerCancel={() => {
        pointerStartY.current = null
      }}
    >
      <legend className="sr-only">{t('terminal.historyNav.label')}</legend>
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform duration-150',
          direction === 'previous' && '-translate-y-0.5',
          direction === 'next' && 'translate-y-0.5'
        )}
        aria-hidden
      >
        <History className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-xs">{t('terminal.historyNav.title')}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {index === null
              ? t('terminal.historyNav.latest')
              : t('terminal.historyNav.position', { current: index + 1, count })}
          </span>
        </div>
        <p className="truncate text-[10px] text-muted-foreground">
          {t('terminal.historyNav.swipeHint')}
        </p>
      </div>

      <div className="flex shrink-0 items-center rounded-md border border-border/70 bg-background/70 p-0.5 shadow-xs">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-9 touch-manipulation p-0"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => move('previous')}
          disabled={!canPrevious}
          aria-label={t('terminal.historyNav.previous')}
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
        </Button>
        <div className="h-5 w-px bg-border/70" aria-hidden />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-9 touch-manipulation p-0"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => move('next')}
          disabled={!canNext}
          aria-label={t('terminal.historyNav.next')}
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </fieldset>
  )
}
