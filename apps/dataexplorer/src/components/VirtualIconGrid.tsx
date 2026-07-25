import { cn } from '@4d/ui'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { resolveLucideIcon } from '~/lib/lucide-icon'

const GAP_PX = 4

type VirtualIconGridProps = {
  icons: readonly string[]
  value?: string
  onSelect: (name: string) => void
  className?: string
  /** Viewport height in px */
  height?: number
  columns?: number
  /** Button size in px (width & height) */
  cellSize?: number
  /** Bump to re-scroll the current value into view (e.g. after randomize) */
  scrollNonce?: number
}

/**
 * Row-virtualized Lucide icon grid. Only mounts icons near the viewport
 * so catalogs of 1k+ icons stay responsive.
 */
export function VirtualIconGrid({
  icons,
  value,
  onSelect,
  className,
  height = 200,
  columns = 6,
  cellSize = 36,
  scrollNonce = 0,
}: VirtualIconGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowHeight = cellSize + GAP_PX
  const rowCount = Math.ceil(icons.length / columns) || 0

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 6,
  })

  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    if (value) {
      const index = icons.indexOf(value)
      if (index >= 0) {
        const row = Math.floor(index / columns)
        const smooth = scrollNonce > 0
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(row, {
            align: 'center',
            behavior: smooth ? 'smooth' : 'auto',
          })
        })
        return
      }
    }

    el.scrollTo({ top: 0 })
  }, [value, icons, columns, scrollNonce, virtualizer.scrollToIndex])

  return (
    <div
      ref={parentRef}
      className={cn(
        'overflow-y-auto rounded-lg border p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
      style={{ height }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns
          const rowIcons = icons.slice(start, start + columns)
          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 grid w-full"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: GAP_PX,
              }}
            >
              {rowIcons.map((iconName) => {
                const Icon = resolveLucideIcon(iconName)
                if (!Icon) return <div key={iconName} />
                const isSelected = value === iconName
                return (
                  <button
                    type="button"
                    key={iconName}
                    title={iconName}
                    aria-label={iconName}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(iconName)}
                    className={cn(
                      'inline-flex size-full items-center justify-center rounded-lg transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    style={{ height: cellSize }}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
