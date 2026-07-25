import { Button, ClickToCopy, cn } from '@4d/ui'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Activity, Binary, ChevronDown, ChevronRight, Sigma } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import type { VectorDecoded } from './types'

const SAMPLE_COUNT = 8
const ELEMENT_ROW_HEIGHT = 22
const ELEMENT_LIST_HEIGHT = 256

function computeStats(elements: number[]) {
  if (elements.length === 0) {
    return { min: 0, max: 0, mean: 0, norm: 0 }
  }

  let min = elements[0]
  let max = elements[0]
  let sum = 0
  let sumSq = 0

  for (const value of elements) {
    if (value < min) min = value
    if (value > max) max = value
    sum += value
    sumSq += value * value
  }

  return {
    min,
    max,
    mean: sum / elements.length,
    norm: Math.sqrt(sumSq),
  }
}

function formatExactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(value)
}

/** Compact display for tight stat cards; full precision stays in `title`. */
function formatStatDisplay(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) {
    return value.toExponential(6)
  }
  return Number(value.toPrecision(8)).toString()
}

interface VectorBinaryViewProps {
  data: VectorDecoded
  className?: string
}

export function VectorBinaryView({ data, className }: VectorBinaryViewProps) {
  const { t } = useTranslation()
  const [showDetails, setShowDetails] = useState(false)
  const stats = useMemo(
    () => (showDetails ? computeStats(data.elements) : null),
    [data.elements, showDetails]
  )

  const tagLabels = (data.tags ?? []).map((tag) =>
    tag === '32' ? 'f32' : tag === '64' ? 'f64' : tag
  )
  const samplePreview = data.elements
    .slice(0, SAMPLE_COUNT)
    .map((value) => formatExactNumber(value))
    .join(', ')
  const elementsJson = JSON.stringify(data.elements)
  const hasMore = data.elements.length > SAMPLE_COUNT

  return (
    <div className={cn('overflow-hidden rounded-md border bg-muted/20 text-xs', className)}>
      <div className="flex items-start gap-2 border-b bg-muted/30 p-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-background text-cyan-700 dark:text-cyan-300">
          <Binary className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-xs">{data.name}</span>
            {tagLabels.map((tag) => (
              <span
                key={tag}
                className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wide"
              >
                {tag}
              </span>
            ))}
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-800 uppercase tracking-wide dark:text-cyan-200">
              {t('entity.binaryVectorDims', { count: data.length })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">{t('entity.binaryVectorHint')}</p>
        </div>
        <ClickToCopy
          value={elementsJson}
          tooltipLabel={t('entity.binaryVectorCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border bg-background px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {t('entity.binaryVectorCopyShort')}
        </ClickToCopy>
      </div>

      <div className="space-y-2 p-2">
        <div className="rounded-md border bg-background/60 px-2 py-1.5">
          <div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
            {t('entity.binaryVectorSample')}
          </div>
          <code className="block overflow-x-auto font-mono text-[11px] text-foreground/90">
            [{samplePreview}
            {hasMore ? ', …' : ''}]
          </code>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-full justify-start gap-1.5 px-1.5 text-[11px] text-muted-foreground"
          onClick={() => setShowDetails((prev) => !prev)}
        >
          {showDetails ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {showDetails
            ? t('entity.binaryVectorHideDetails')
            : t('entity.binaryVectorShowDetails', { count: data.length })}
        </Button>

        {showDetails && stats ? (
          <div className="space-y-3 border-t pt-3">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                icon={<Sigma className="h-3 w-3" />}
                label={t('entity.binaryVectorNorm')}
                value={stats.norm}
              />
              <Stat label={t('entity.binaryVectorMin')} value={stats.min} />
              <Stat label={t('entity.binaryVectorMax')} value={stats.max} />
              <Stat
                icon={<Activity className="h-3 w-3" />}
                label={t('entity.binaryVectorMean')}
                value={stats.mean}
              />
            </dl>

            <div className="rounded-md border bg-background/60 px-2.5 py-2">
              <div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                {t('entity.binaryVectorElements')}
              </div>
              <VectorElementsList elements={data.elements} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function VectorElementsList({ elements }: { elements: number[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: elements.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ELEMENT_ROW_HEIGHT,
    overscan: 16,
  })

  const height = Math.min(
    ELEMENT_LIST_HEIGHT,
    Math.max(ELEMENT_ROW_HEIGHT, elements.length * ELEMENT_ROW_HEIGHT)
  )

  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded border bg-background/80 font-mono text-[11px]"
      style={{ height }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const value = elements[item.index] ?? 0
          return (
            <div
              key={item.key}
              className="absolute top-0 left-0 flex w-full border-border/40 border-b"
              style={{
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <span className="w-14 shrink-0 px-2 py-0.5 text-right text-muted-foreground tabular-nums">
                {item.index}
              </span>
              <span className="px-2 py-0.5 text-foreground/90 tabular-nums">
                {formatExactNumber(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  const exact = formatExactNumber(value)
  const display = formatStatDisplay(value)
  return (
    <div className="min-w-0 space-y-0.5 overflow-hidden rounded-md border bg-background/60 px-2.5 py-2">
      <dt className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground uppercase tracking-wider">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </dt>
      <dd
        className="min-w-0 break-all font-mono text-[11px] tabular-nums leading-snug"
        title={exact}
      >
        {display}
      </dd>
    </div>
  )
}
