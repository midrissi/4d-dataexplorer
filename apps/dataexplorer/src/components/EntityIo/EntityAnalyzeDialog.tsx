import type { ComputeResult, SimpleComputeResult } from '@4d/rest'
import { Button, Dialog, Input, useToast } from '@4d/ui'
import {
  BarChart3,
  Calculator,
  Copy,
  ListFilter,
  Loader2,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import {
  analyzableAttributes,
  type EntityIoAttribute,
  isNumericAttributeType,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { EntityAnalyzeStat } from './EntityAnalyzeStat'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect } from './EntityIoSelect'

function normalizeCompute(
  attribute: string,
  result: ComputeResult | SimpleComputeResult
): {
  count?: number
  sum?: number
  average?: number
  min?: number | string
  max?: number | string
} {
  if (typeof result === 'number' || typeof result === 'string') {
    return { count: undefined, min: result, max: result }
  }
  const nested = result[attribute] ?? Object.values(result)[0]
  if (nested && typeof nested === 'object') return nested
  return {}
}

export function EntityAnalyzeDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: EntityIoTarget | null
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [attrs, setAttrs] = useState<EntityIoAttribute[]>([])
  const [attribute, setAttribute] = useState('')
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [distinctValues, setDistinctValues] = useState<unknown[]>([])
  const [computeStats, setComputeStats] = useState<ReturnType<typeof normalizeCompute> | null>(null)
  const [filterText, setFilterText] = useState('')

  const dataclassName = target?.dataclassName ?? ''

  useEffect(() => {
    if (!open || !dataclassName) return
    let cancelled = false
    setLoadingSchema(true)
    setError(null)
    setDistinctValues([])
    setComputeStats(null)
    void api
      .getDataclassSchema(dataclassName)
      .then((schema) => {
        if (cancelled) return
        const list = analyzableAttributes(schema.attributes as EntityIoAttribute[])
        setAttrs(list)
        setAttribute((prev) =>
          prev && list.some((a) => a.name === prev) ? prev : (list[0]?.name ?? '')
        )
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoadingSchema(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, dataclassName])

  const selectedAttr = useMemo(() => attrs.find((a) => a.name === attribute), [attrs, attribute])
  const numeric = selectedAttr ? isNumericAttributeType(selectedAttr.type) : false

  const runAnalyze = useCallback(async () => {
    if (!target || !attribute) return
    setLoading(true)
    setError(null)
    try {
      const common = {
        dataclass: target.dataclassName,
        attribute,
        entitySetId: target.entitySetId?.trim() || undefined,
        filter: target.entitySetId ? undefined : target.filter,
        filterParams: target.entitySetId ? undefined : target.filterParams,
      }
      const [distinctRes, computeRes] = await Promise.all([
        api.getDistinctValues({ ...common, top: 500 }),
        api.computeAttribute({ ...common, operation: '$all' }),
      ])
      setDistinctValues(distinctRes.values)
      setComputeStats(normalizeCompute(attribute, computeRes.result))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDistinctValues([])
      setComputeStats(null)
    } finally {
      setLoading(false)
    }
  }, [attribute, target])

  useEffect(() => {
    if (!open || !attribute || loadingSchema) return
    void runAnalyze()
  }, [open, attribute, loadingSchema, runAnalyze])

  const filteredDistinct = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return distinctValues
    return distinctValues.filter((v) =>
      String(v ?? '')
        .toLowerCase()
        .includes(q)
    )
  }, [distinctValues, filterText])
  const scope = target?.entitySetId
    ? t('entity.analyze.scopeSelection')
    : target?.filter
      ? t('entity.analyze.scopeFilter')
      : t('entity.analyze.scopeAll')

  const copyValue = async (value: unknown) => {
    try {
      await navigator.clipboard.writeText(String(value ?? ''))
      toast({ title: t('entity.analyze.copied') })
    } catch {
      toast({ title: t('entity.analyze.copyFailed'), variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EntityIoDialogFrame
        icon={BarChart3}
        title={t('entity.analyze.title')}
        description={t('entity.analyze.description', { dataclass: dataclassName })}
        badge={scope}
        size="lg"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('entity.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void runAnalyze()}
              disabled={loading || !attribute}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('entity.analyze.refresh')}
            </Button>
          </>
        }
      >
        <EntityIoPanel icon={SlidersHorizontal} title={t('entity.analyze.attribute')}>
          <EntityIoSelect
            id="analyze-attr"
            ariaLabel={t('entity.analyze.attribute')}
            value={attribute}
            disabled={loadingSchema || attrs.length === 0}
            onValueChange={setAttribute}
            options={attrs.map((a) => ({
              value: a.name,
              label: (
                <span className="font-mono">
                  {a.name}
                  <span className="text-muted-foreground"> · {a.type}</span>
                </span>
              ),
            }))}
          />
          {attrs.length === 0 && !loadingSchema ? (
            <p className="mt-1 text-muted-foreground text-xs">{t('entity.analyze.noAttributes')}</p>
          ) : null}
        </EntityIoPanel>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-destructive text-xs"
          >
            {error}
          </p>
        ) : null}

        {loading || loadingSchema ? (
          <div className="flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/10 px-2 py-1.5 text-muted-foreground text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('entity.analyze.loading')}
          </div>
        ) : null}

        {computeStats ? (
          <EntityIoPanel
            icon={Calculator}
            title="$compute"
            contentClassName="grid grid-cols-2 gap-px bg-border/60 p-0 sm:grid-cols-3"
          >
            {computeStats.count != null ? (
              <EntityAnalyzeStat
                label={t('entity.analyze.count')}
                value={String(computeStats.count)}
              />
            ) : null}
            {computeStats.min != null ? (
              <EntityAnalyzeStat label={t('entity.analyze.min')} value={String(computeStats.min)} />
            ) : null}
            {computeStats.max != null ? (
              <EntityAnalyzeStat label={t('entity.analyze.max')} value={String(computeStats.max)} />
            ) : null}
            {numeric && computeStats.sum != null ? (
              <EntityAnalyzeStat label={t('entity.analyze.sum')} value={String(computeStats.sum)} />
            ) : null}
            {numeric && computeStats.average != null ? (
              <EntityAnalyzeStat
                label={t('entity.analyze.average')}
                value={String(computeStats.average)}
              />
            ) : null}
          </EntityIoPanel>
        ) : null}

        <EntityIoPanel
          icon={ListFilter}
          title={t('entity.analyze.distinctValues')}
          count={distinctValues.length}
          className="min-h-0"
          contentClassName="p-0"
          action={
            <div className="relative max-w-48 flex-1">
              <Search
                className="pointer-events-none absolute top-1.5 left-2 h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="h-7 border-border/70 bg-background/80 pl-7 text-xs shadow-none"
                placeholder={t('entity.analyze.search')}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
          }
        >
          <ul className="max-h-64 overflow-auto overscroll-contain">
            {filteredDistinct.length === 0 ? (
              <li className="px-2 py-4 text-center text-muted-foreground text-xs">
                {t('entity.analyze.noDistinct')}
              </li>
            ) : (
              filteredDistinct.map((value) => (
                <li
                  key={`${typeof value}:${JSON.stringify(value)}`}
                  className="flex min-h-8 items-center justify-between gap-2 border-border/50 border-b px-2 py-1 transition-colors last:border-b-0 hover:bg-muted/35"
                >
                  <span className="truncate font-mono text-xs">{String(value ?? '∅')}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => void copyValue(value)}
                    aria-label={t('entity.analyze.copy')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))
            )}
          </ul>
        </EntityIoPanel>
      </EntityIoDialogFrame>
    </Dialog>
  )
}
