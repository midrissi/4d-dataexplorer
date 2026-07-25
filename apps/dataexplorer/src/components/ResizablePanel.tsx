import { cn } from '@4d/ui'
import { ChevronsLeft, ChevronsRight, GripHorizontal, GripVertical } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { getSidebarWidth, setSidebarWidth } from '~/lib/storage'

type ResizablePanelProps = {
  children: ReactNode
  defaultSize: number
  minSize?: number
  maxSize?: number
  direction: 'left' | 'right'
  storageKey?: string
  className?: string
  // Collapse support
  collapsible?: boolean
  collapsedSize?: number
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

export function ResizablePanel({
  children,
  defaultSize,
  minSize = 325,
  maxSize = 600,
  direction,
  storageKey,
  className,
  collapsible = false,
  collapsedSize = 52,
  collapsed = false,
  onCollapsedChange,
}: ResizablePanelProps) {
  const [size, setSize] = useState(() => {
    if (storageKey === 'sidebar' && typeof window !== 'undefined') {
      const stored = getSidebarWidth()
      if (stored >= minSize && stored <= maxSize) {
        return stored
      }
    }
    return defaultSize
  })

  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startSizeRef = useRef(0)
  const wasCollapsedRef = useRef(collapsed)

  // Restore panel size when profile changes (panels prefs are per-profile)
  useEffect(() => {
    if (storageKey === 'sidebar' && typeof window !== 'undefined') {
      const stored = getSidebarWidth()
      const clamped = Math.min(maxSize, Math.max(minSize, stored))
      setSize(clamped)
    }
  }, [storageKey, minSize, maxSize])

  // Save size to storage (only when not collapsed)
  useEffect(() => {
    if (storageKey === 'sidebar' && !collapsed) {
      setSidebarWidth(size)
    }
  }, [size, storageKey, collapsed])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startSizeRef.current = collapsed ? collapsedSize : size
      wasCollapsedRef.current = collapsed
    },
    [size, collapsed, collapsedSize]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta =
        direction === 'left' ? e.clientX - startXRef.current : startXRef.current - e.clientX

      const targetSize = startSizeRef.current + delta

      if (collapsible) {
        // Collapse threshold: if dragging smaller than midpoint between collapsed and min
        const collapseThreshold = (collapsedSize + minSize) / 2

        if (targetSize < collapseThreshold) {
          // Should be collapsed
          if (!collapsed) {
            onCollapsedChange?.(true)
          }
        } else {
          // Should be expanded
          if (collapsed || wasCollapsedRef.current) {
            onCollapsedChange?.(false)
            wasCollapsedRef.current = false
          }
          const newSize = Math.min(maxSize, Math.max(minSize, targetSize))
          setSize(newSize)
        }
      } else {
        const newSize = Math.min(maxSize, Math.max(minSize, targetSize))
        setSize(newSize)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Add cursor style to body during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [
    isResizing,
    direction,
    minSize,
    maxSize,
    collapsible,
    collapsed,
    collapsedSize,
    onCollapsedChange,
  ])

  // Sync size when coming out of collapsed state
  useEffect(() => {
    if (!collapsed && storageKey === 'sidebar') {
      const stored = getSidebarWidth()
      if (stored >= minSize && stored <= maxSize) {
        setSize(stored)
      }
    }
  }, [collapsed, storageKey, minSize, maxSize])

  const handleDoubleClick = useCallback(() => {
    if (collapsible) {
      onCollapsedChange?.(!collapsed)
    } else {
      setSize(defaultSize)
    }
  }, [collapsible, collapsed, onCollapsedChange, defaultSize])

  const { t } = useTranslation()
  const currentSize = collapsed ? collapsedSize : size
  const CollapseIcon =
    direction === 'left'
      ? collapsed
        ? ChevronsRight
        : ChevronsLeft
      : collapsed
        ? ChevronsLeft
        : ChevronsRight

  return (
    <div
      ref={panelRef}
      className={cn('relative flex shrink-0 transition-[width] duration-200', className)}
      style={{ width: currentSize }}
    >
      {/* Panel content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Resize handle */}
      <button
        type="button"
        className={cn(
          'group absolute top-0 bottom-0 z-20 flex w-1 cursor-col-resize items-center justify-center border-none bg-transparent p-0 transition-colors hover:bg-primary/20 focus:outline-none focus-visible:bg-primary/20',
          direction === 'left' ? 'right-0' : 'left-0',
          isResizing && 'bg-primary/30'
        )}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        aria-label={
          collapsible
            ? collapsed
              ? t('common.expandPanel')
              : t('common.collapsePanel')
            : t('common.resizePanelAria')
        }
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            if (collapsible && !collapsed && size <= minSize) {
              onCollapsedChange?.(true)
            } else if (!collapsed) {
              setSize((s) => Math.max(minSize, s - 10))
            }
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            if (collapsible && collapsed) {
              onCollapsedChange?.(false)
            } else if (!collapsed) {
              setSize((s) => Math.min(maxSize, s + 10))
            }
          } else if (e.key === 'Home') {
            e.preventDefault()
            if (collapsible) {
              onCollapsedChange?.(true)
            } else {
              setSize(minSize)
            }
          } else if (e.key === 'End') {
            e.preventDefault()
            if (collapsed) onCollapsedChange?.(false)
            setSize(maxSize)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (collapsible) {
              onCollapsedChange?.(!collapsed)
            } else {
              setSize(defaultSize)
            }
          }
        }}
      >
        <span
          className={cn(
            'flex h-8 w-3 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100',
            isResizing && 'opacity-100'
          )}
        >
          {collapsible ? (
            <CollapseIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </button>
    </div>
  )
}

type ResizableHandleProps = {
  onResize: (delta: number) => void
  onDoubleClick?: () => void
  className?: string
}

export function ResizableHandle({ onResize, onDoubleClick, className }: ResizableHandleProps) {
  const { t } = useTranslation()
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, onResize])

  return (
    <button
      type="button"
      className={cn(
        'group relative z-20 flex w-px shrink-0 cursor-col-resize items-center justify-center border-none bg-border p-0 transition-colors hover:bg-primary/50 focus:outline-none focus-visible:bg-primary/50',
        isResizing && 'bg-primary',
        className
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      aria-label={t('common.resizePanelAria')}
    >
      <span
        className={cn(
          'absolute flex h-8 w-4 items-center justify-center rounded-sm bg-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
          isResizing && 'opacity-100'
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </span>
    </button>
  )
}

type ResizableVerticalHandleProps = {
  onResize: (delta: number) => void
  onDoubleClick?: () => void
  className?: string
}

/**
 * Horizontal divider used to resize vertically stacked panels.
 * Positive deltas mean the pointer moved down.
 */
export function ResizableVerticalHandle({
  onResize,
  onDoubleClick,
  className,
}: ResizableVerticalHandleProps) {
  const { t } = useTranslation()
  const [isResizing, setIsResizing] = useState(false)
  const startYRef = useRef(0)

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setIsResizing(true)
    startYRef.current = event.clientY
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientY - startYRef.current
      startYRef.current = event.clientY
      onResize(delta)
    }
    const handleMouseUp = () => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, onResize])

  return (
    <button
      type="button"
      className={cn(
        'group relative z-20 flex h-px w-full shrink-0 cursor-row-resize items-center justify-center border-none bg-border p-0 transition-colors hover:bg-primary/50 focus:outline-none focus-visible:bg-primary/50',
        isResizing && 'bg-primary',
        className
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          onResize(-10)
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          onResize(10)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          onDoubleClick?.()
        }
      }}
      aria-label={t('common.resizePanelAria')}
    >
      <span
        className={cn(
          'absolute flex h-4 w-8 items-center justify-center rounded-sm bg-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
          isResizing && 'opacity-100'
        )}
      >
        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
      </span>
    </button>
  )
}
