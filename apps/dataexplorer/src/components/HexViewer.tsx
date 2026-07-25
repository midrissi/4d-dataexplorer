import { Button, ClickToCopy, cn } from '@4d/ui'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Binary, Copy } from 'lucide-react'
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '~/i18n'

const BYTES_PER_ROW = 16
const ROW_HEIGHT = 28
/** Fixed cell width for a hex byte (matches Tailwind `w-5`). */
const HEX_CELL = '1.25rem'
/** Gap between hex cells (matches Tailwind `gap-1`). */
const HEX_GAP = '0.25rem'
/** Extra gap between byte groups 0–7 and 8–15 (matches Tailwind `ml-2`). */
const HEX_GROUP_GAP = '0.5rem'
/** Fixed cell width for an ASCII glyph (matches Tailwind `w-2.5`). */
const ASCII_CELL = '0.625rem'

/**
 * Shared outer grid so header and body columns stay locked together.
 * Fixed widths avoid `auto`/`1fr` sizing that diverged between the OFFSET
 * label row and the numeric offset body rows.
 */
function rowGridTemplate(offsetWidth: number, bytesPerRow: number): string {
  const offsetCol = `${Math.max(offsetWidth, 8)}ch`
  const hexCol = `calc(${bytesPerRow} * ${HEX_CELL} + ${bytesPerRow - 1} * ${HEX_GAP} + ${HEX_GROUP_GAP})`
  const asciiCol = `calc(${bytesPerRow} * ${ASCII_CELL} + 0.5rem)`
  return `${offsetCol} ${hexCol} ${asciiCol}`
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0')
}

function toOffset(value: number, width = 8): string {
  return value.toString(16).padStart(width, '0')
}

function isPrintable(value: number): boolean {
  return value >= 0x20 && value < 0x7f
}

type AsciiKind = 'text' | 'space' | 'control' | 'unknown'

type AsciiDisplay = {
  glyph: string
  kind: AsciiKind
  /** Readable label for tooltips / status (e.g. "SPACE", "LF"). */
  label?: string
}

/** Map a byte to a visible ASCII-column glyph + semantic kind. */
function asciiDisplay(value: number): AsciiDisplay {
  switch (value) {
    case 0x00:
      return { glyph: '·', kind: 'control', label: 'NUL' }
    case 0x09:
      return { glyph: '→', kind: 'control', label: 'TAB' }
    case 0x0a:
      return { glyph: '↵', kind: 'control', label: 'LF' }
    case 0x0d:
      return { glyph: '←', kind: 'control', label: 'CR' }
    case 0x20:
      return { glyph: '·', kind: 'space', label: 'SPACE' }
    default:
      break
  }
  if (value >= 0x21 && value < 0x7f) {
    return { glyph: String.fromCharCode(value), kind: 'text' }
  }
  return { glyph: '×', kind: 'unknown', label: `0x${toHexByte(value)}` }
}

const asciiKindClass: Record<AsciiKind, string> = {
  text: 'text-emerald-700 dark:text-emerald-400',
  space: 'text-amber-600/80 dark:text-amber-400/80',
  control: 'text-sky-600 dark:text-sky-400',
  unknown: 'text-muted-foreground/55',
}

function selectionBounds(
  anchor: number | null,
  focus: number | null
): { start: number; end: number } | null {
  if (anchor == null || focus == null) return null
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
  }
}

function bytesToHexString(bytes: Uint8Array, start: number, end: number): string {
  const parts: string[] = []
  for (let i = start; i <= end; i++) {
    parts.push(toHexByte(bytes[i] ?? 0))
  }
  return parts.join(' ')
}

function bytesToAsciiString(bytes: Uint8Array, start: number, end: number): string {
  let out = ''
  for (let i = start; i <= end; i++) {
    const b = bytes[i] ?? 0
    out += isPrintable(b) ? String.fromCharCode(b) : '.'
  }
  return out
}

type HexViewerProps = {
  bytes: Uint8Array
  className?: string
  /** Bytes per row (default 16). */
  bytesPerRow?: number
}

/** Distance from the scrollport edge that starts auto-scroll while dragging. */
const DRAG_SCROLL_EDGE_PX = 36
/** Peak pixels-per-frame while the pointer sits at the extreme edge. */
const DRAG_SCROLL_MAX_PX = 18

/**
 * Design-system hex dump viewer with synchronized hex/ASCII selection,
 * virtualized rows, and a status footer for offset / copy actions.
 */
export function HexViewer({ bytes, className, bytesPerRow = BYTES_PER_ROW }: HexViewerProps) {
  const { t } = useTranslation()
  const parentRef = useRef<HTMLDivElement>(null)
  const dragPointerRef = useRef({ x: 0, y: 0 })
  const dragColumnRef = useRef(0)
  const dragMetaRef = useRef({ bytesLength: 0, bytesPerRow, rowCount: 1 })
  const [anchor, setAnchor] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const rowCount = Math.max(1, Math.ceil(bytes.length / bytesPerRow) || 1)
  dragMetaRef.current = { bytesLength: bytes.length, bytesPerRow, rowCount }
  const offsetWidth = Math.max(4, toOffset(Math.max(0, bytes.length - 1)).length)
  const columnHeaders = useMemo(
    () => Array.from({ length: bytesPerRow }, (_, i) => toHexByte(i)),
    [bytesPerRow]
  )
  const groupStart = bytesPerRow / 2
  const gridTemplateColumns = rowGridTemplate(offsetWidth, bytesPerRow)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const selection = selectionBounds(anchor, focus)
  const activeIndex = hover ?? focus

  const selectionHex = useMemo(() => {
    if (!selection || bytes.length === 0) return ''
    return bytesToHexString(bytes, selection.start, Math.min(selection.end, bytes.length - 1))
  }, [bytes, selection])

  const selectionAscii = useMemo(() => {
    if (!selection || bytes.length === 0) return ''
    return bytesToAsciiString(bytes, selection.start, Math.min(selection.end, bytes.length - 1))
  }, [bytes, selection])

  const statusByte =
    activeIndex != null && activeIndex < bytes.length ? (bytes[activeIndex] ?? 0) : null

  const selectByte = useCallback(
    (index: number, extend: boolean) => {
      if (index < 0 || index >= bytes.length) return
      dragColumnRef.current = index % bytesPerRow
      if (extend && anchor != null) {
        setFocus(index)
      } else {
        setAnchor(index)
        setFocus(index)
      }
    },
    [anchor, bytes.length, bytesPerRow]
  )

  const beginDrag = useCallback(
    (event: ReactMouseEvent, index: number) => {
      event.preventDefault()
      parentRef.current?.focus()
      dragPointerRef.current = { x: event.clientX, y: event.clientY }
      dragColumnRef.current = index % bytesPerRow
      setDragging(true)
      selectByte(index, event.shiftKey)
    },
    [bytesPerRow, selectByte]
  )

  // While dragging: map pointer → byte, and auto-scroll near the viewport edges.
  useEffect(() => {
    if (!dragging) return
    const el = parentRef.current
    if (!el) return

    let rafId = 0
    let pointerX = dragPointerRef.current.x
    let pointerY = dragPointerRef.current.y

    const clampIndex = (index: number) => {
      const { bytesLength } = dragMetaRef.current
      return Math.max(0, Math.min(bytesLength - 1, index))
    }

    const indexAtPointer = (): number | null => {
      const { bytesLength, bytesPerRow: bpr, rowCount: rows } = dragMetaRef.current
      if (bytesLength === 0) return null

      const hit = document.elementFromPoint(pointerX, pointerY)
      const cell = hit instanceof Element ? hit.closest('[data-byte-index]') : null
      if (cell instanceof HTMLElement && cell.dataset.byteIndex != null) {
        const idx = Number(cell.dataset.byteIndex)
        if (!Number.isNaN(idx) && idx >= 0 && idx < bytesLength) {
          dragColumnRef.current = idx % bpr
          return idx
        }
      }

      // Pointer is past the edge (or over padding): keep the last column, pick the row from Y.
      const rect = el.getBoundingClientRect()
      const yInContent = pointerY - rect.top + el.scrollTop
      const row = Math.floor(yInContent / ROW_HEIGHT)
      const col = dragColumnRef.current
      if (row < 0) return clampIndex(col)
      if (row >= rows) return clampIndex((rows - 1) * bpr + col)
      return clampIndex(row * bpr + col)
    }

    const applySelection = () => {
      const idx = indexAtPointer()
      if (idx == null) return
      setFocus(idx)
      setHover(idx)
    }

    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      dragPointerRef.current = { x: pointerX, y: pointerY }
      applySelection()
    }

    const tick = () => {
      const rect = el.getBoundingClientRect()
      let delta = 0
      if (pointerY < rect.top + DRAG_SCROLL_EDGE_PX) {
        const t = Math.min(1, (rect.top + DRAG_SCROLL_EDGE_PX - pointerY) / DRAG_SCROLL_EDGE_PX)
        delta = -Math.max(1, Math.round(t * DRAG_SCROLL_MAX_PX))
      } else if (pointerY > rect.bottom - DRAG_SCROLL_EDGE_PX) {
        const t = Math.min(
          1,
          (pointerY - (rect.bottom - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX
        )
        delta = Math.max(1, Math.round(t * DRAG_SCROLL_MAX_PX))
      }
      if (delta !== 0) {
        const prev = el.scrollTop
        el.scrollTop = prev + delta
        if (el.scrollTop !== prev) applySelection()
      }
      rafId = requestAnimationFrame(tick)
    }

    const onUp = () => setDragging(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    applySelection()
    rafId = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      cancelAnimationFrame(rafId)
    }
  }, [dragging])

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (bytes.length === 0) return
      const current = focus ?? 0
      let next = current
      if (event.key === 'ArrowLeft') next = current - 1
      else if (event.key === 'ArrowRight') next = current + 1
      else if (event.key === 'ArrowUp') next = current - bytesPerRow
      else if (event.key === 'ArrowDown') next = current + bytesPerRow
      else if (event.key === 'Home')
        next = event.metaKey || event.ctrlKey ? 0 : current - (current % bytesPerRow)
      else if (event.key === 'End') {
        next =
          event.metaKey || event.ctrlKey
            ? bytes.length - 1
            : Math.min(bytes.length - 1, current - (current % bytesPerRow) + bytesPerRow - 1)
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setAnchor(0)
        setFocus(bytes.length - 1)
        virtualizer.scrollToIndex(rowCount - 1, { align: 'end' })
        return
      } else {
        return
      }
      event.preventDefault()
      next = Math.max(0, Math.min(bytes.length - 1, next))
      selectByte(next, event.shiftKey)
      virtualizer.scrollToIndex(Math.floor(next / bytesPerRow), { align: 'auto' })
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [bytes.length, bytesPerRow, focus, rowCount, selectByte, virtualizer])

  if (bytes.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm',
          className
        )}
      >
        {t('hexViewer.empty')}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background text-muted-foreground">
          <Binary className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-xs">{t('hexViewer.title')}</p>
          <p className="text-[10px] text-muted-foreground">
            {t('hexViewer.subtitle', { count: bytes.length.toLocaleString() })}
          </p>
        </div>
        {selection ? (
          <div className="flex items-center gap-1.5">
            <ClickToCopy
              value={selectionHex}
              tooltipLabel={t('hexViewer.copyHex')}
              tooltipCopiedLabel={t('common.copied')}
              className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-3 w-3" />
              {t('hexViewer.copyHex')}
            </ClickToCopy>
            <ClickToCopy
              value={selectionAscii}
              tooltipLabel={t('hexViewer.copyAscii')}
              tooltipCopiedLabel={t('common.copied')}
              className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-3 w-3" />
              {t('hexViewer.copyAscii')}
            </ClickToCopy>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setAnchor(null)
                setFocus(null)
              }}
            >
              {t('hexViewer.clearSelection')}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className="grid shrink-0 items-center gap-x-3 border-b bg-muted/25 px-3 py-1 font-mono text-[11px] text-muted-foreground uppercase"
        style={{ gridTemplateColumns }}
      >
        <span className="tabular-nums tracking-wider">{t('hexViewer.offset')}</span>
        <div className="flex items-center" style={{ gap: HEX_GAP }}>
          {columnHeaders.map((label, i) => (
            <span
              key={label}
              className="inline-flex shrink-0 items-center justify-center tabular-nums"
              style={{
                width: HEX_CELL,
                height: HEX_CELL,
                marginLeft: i === groupStart ? HEX_GROUP_GAP : undefined,
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <span className="text-center tracking-wider">{t('hexViewer.ascii')}</span>
      </div>

      <div
        ref={parentRef}
        role="application"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: single focus target for arrow-key navigation
        tabIndex={0}
        aria-label={t('hexViewer.title')}
        className="min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset"
      >
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const rowIndex = virtualRow.index
            const rowStart = rowIndex * bytesPerRow
            const even = rowIndex % 2 === 0

            return (
              <div
                key={virtualRow.key}
                className={cn(
                  'absolute left-0 grid w-full items-center gap-x-3 px-3 font-mono text-[11px] leading-none',
                  even ? 'bg-background' : 'bg-muted/15'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns,
                }}
              >
                <span className="select-none text-muted-foreground/80 tabular-nums">
                  {toOffset(rowStart, offsetWidth)}
                </span>

                <div className="flex items-center" style={{ gap: HEX_GAP }}>
                  {columnHeaders.map((label, col) => {
                    const index = rowStart + col
                    const cellStyle = {
                      width: HEX_CELL,
                      height: HEX_CELL,
                      marginLeft: col === groupStart ? HEX_GROUP_GAP : undefined,
                    }

                    if (index >= bytes.length) {
                      return (
                        <span
                          key={`hex-pad-${rowStart}-${label}`}
                          className="inline-block shrink-0"
                          style={cellStyle}
                        />
                      )
                    }
                    const value = bytes[index] ?? 0
                    const selected =
                      selection != null && index >= selection.start && index <= selection.end
                    const hovered = hover === index
                    const isNull = value === 0

                    return (
                      <button
                        key={`hex-${index}`}
                        type="button"
                        data-byte-index={index}
                        aria-pressed={selected}
                        style={cellStyle}
                        className={cn(
                          'inline-flex shrink-0 cursor-default items-center justify-center rounded-sm tabular-nums transition-colors',
                          isNull && !selected && !hovered && 'text-muted-foreground/45',
                          !isNull && !selected && 'text-foreground/90',
                          hovered && !selected && 'bg-primary/15 text-foreground',
                          selected && 'bg-primary/30 text-foreground ring-1 ring-primary/40'
                        )}
                        onMouseEnter={() => {
                          setHover(index)
                          if (dragging) {
                            dragColumnRef.current = index % bytesPerRow
                            setFocus(index)
                          }
                        }}
                        onMouseLeave={() => setHover((h) => (h === index ? null : h))}
                        onMouseDown={(event) => beginDrag(event, index)}
                      >
                        {toHexByte(value)}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center justify-center rounded-sm border border-transparent bg-muted/20 px-1 py-0.5">
                  {columnHeaders.map((label, col) => {
                    const index = rowStart + col
                    if (index >= bytes.length) {
                      return (
                        <span
                          key={`ascii-pad-${rowStart}-${label}`}
                          className="inline-block shrink-0"
                          style={{ width: ASCII_CELL, height: HEX_CELL }}
                        />
                      )
                    }
                    const value = bytes[index] ?? 0
                    const selected =
                      selection != null && index >= selection.start && index <= selection.end
                    const hovered = hover === index
                    const display = asciiDisplay(value)

                    return (
                      <button
                        key={`ascii-${index}`}
                        type="button"
                        data-byte-index={index}
                        aria-pressed={selected}
                        title={display.label}
                        style={{ width: ASCII_CELL, height: HEX_CELL }}
                        className={cn(
                          'inline-flex shrink-0 cursor-default items-center justify-center rounded-xs transition-colors',
                          !selected && asciiKindClass[display.kind],
                          hovered && !selected && 'bg-primary/15',
                          selected && 'bg-primary/30 text-foreground ring-1 ring-primary/40'
                        )}
                        onMouseEnter={() => {
                          setHover(index)
                          if (dragging) {
                            dragColumnRef.current = index % bytesPerRow
                            setFocus(index)
                          }
                        }}
                        onMouseLeave={() => setHover((h) => (h === index ? null : h))}
                        onMouseDown={(event) => beginDrag(event, index)}
                      >
                        {display.glyph}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        <span>
          {t('hexViewer.statusOffset')}{' '}
          <span className="text-foreground">
            {activeIndex != null ? `0x${toOffset(activeIndex)}` : '—'}
          </span>
        </span>
        <span>
          {t('hexViewer.statusByte')}{' '}
          <span className="text-foreground">
            {statusByte != null
              ? (() => {
                  const display = asciiDisplay(statusByte)
                  const detail =
                    display.kind === 'text'
                      ? `'${display.glyph}'`
                      : (display.label ?? display.glyph)
                  return `${toHexByte(statusByte).toUpperCase()} (${statusByte}) ${detail}`
                })()
              : '—'}
          </span>
        </span>
        <span className="min-w-0 truncate">
          {t('hexViewer.statusSelection')}{' '}
          <span className="text-foreground">
            {selection
              ? t('hexViewer.selectionCount', {
                  count: selection.end - selection.start + 1,
                })
              : t('hexViewer.noSelection')}
          </span>
        </span>
      </div>
    </div>
  )
}
