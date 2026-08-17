import * as React from 'react'
import { createPortal } from 'react-dom'
import { useDocumentWheelScroll } from '../hooks/use-document-wheel-scroll'
import { cn } from '../lib/utils'
import { EnvTemplateSuggestOption } from './env-template-suggest-option'
import { TooltipProvider } from './tooltip'
import type { EnvTemplateSuggestListProps } from './use-env-template-autocomplete'

const LIST_FOOTER_HEIGHT = 30

export function EnvTemplateSuggestList({
  id,
  items,
  activeIndex,
  placement,
  groupLabels,
  listRef,
  onListInteraction,
  onHover,
  onSelect,
}: EnvTemplateSuggestListProps) {
  const width = Math.min(Math.max(placement.width, 280), 420)
  const [previewKey, setPreviewKey] = React.useState<string | null>(null)
  const bodyMaxHeight = Math.max(80, placement.maxHeight - LIST_FOOTER_HEIGHT)
  // Nested scroller: hit-test the outer listbox shell (parent), including when
  // the caret stays in the field under a Dialog RemoveScroll lock.
  const scrollBodyRef = useDocumentWheelScroll({
    getHitRoot: (el) => el.parentElement,
    includeFocusedTextControl: true,
  })

  return createPortal(
    <TooltipProvider delayDuration={300}>
      <div
        ref={listRef}
        id={id}
        role="listbox"
        aria-label="Environment variables"
        style={{
          position: 'fixed',
          top: placement.side === 'bottom' ? placement.top : undefined,
          bottom: placement.side === 'top' ? window.innerHeight - placement.top : undefined,
          left: placement.left,
          width,
          maxHeight: placement.maxHeight,
        }}
        className={cn(
          // Above dialog overlay/content (z-50) so the list receives pointer + wheel.
          'pointer-events-auto z-[60] flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-sm',
          'fade-in-0 zoom-in-95 animate-in duration-fast',
          placement.side === 'bottom' ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'
        )}
        onPointerDown={() => onListInteraction?.(true)}
        onPointerUp={() => onListInteraction?.(false)}
        onPointerCancel={() => onListInteraction?.(false)}
      >
        <div
          ref={scrollBodyRef}
          className="overflow-y-auto overscroll-contain p-0.5"
          style={{ maxHeight: bodyMaxHeight }}
        >
          {items.map((item, index) => {
            const itemId = `${item.group ?? ''}:${item.key}`
            return (
              <EnvTemplateSuggestOption
                key={itemId}
                id={id}
                index={index}
                item={item}
                previousGroup={index > 0 ? items[index - 1]?.group : undefined}
                groupLabels={groupLabels}
                selected={index === activeIndex}
                previewOpen={previewKey === itemId}
                onHover={onHover}
                onSelect={onSelect}
                onPreviewChange={setPreviewKey}
              />
            )
          })}
        </div>
        <div
          className="flex shrink-0 items-center justify-end gap-1.5 border-border/70 border-t bg-muted/30 px-2.5 py-1"
          aria-hidden
        >
          <kbd className="rounded-sm border border-border/80 bg-background px-1 py-px font-mono text-[9px] text-muted-foreground">
            ↑↓
          </kbd>
          <kbd className="rounded-sm border border-border/80 bg-background px-1 py-px font-mono text-[9px] text-muted-foreground">
            ↵
          </kbd>
          <kbd className="rounded-sm border border-border/80 bg-background px-1 py-px font-mono text-[9px] text-muted-foreground">
            ⇥
          </kbd>
        </div>
      </div>
    </TooltipProvider>,
    document.body
  )
}
