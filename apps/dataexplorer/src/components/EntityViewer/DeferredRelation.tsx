import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ExternalLink,
  Link2,
  Loader2,
  Network,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorList } from '~/components/ErrorList'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { isInternalAttribute } from '~/lib/entity-viewer/attributes'
import { extractEntitySetId } from '~/lib/extract-entity-set-id'
import { useDataExplorerStore } from '~/store'
import { useTabsStore } from '~/store/tabs'
import { MetadataPanel } from './MetadataPanel'
import { RelatedEntityForm } from './RelatedEntityForm'
import { RelatedEntityTable } from './RelatedEntityTable'
import { TreeNode } from './TreeNode'

const RELATED_PAGE_SIZE = 20

export function DeferredRelation({
  name,
  uri,
  kind,
  relatedDataclass,
  displayMode = 'tree',
}: {
  name: string | number
  uri: string
  kind: 'relatedEntity' | 'relatedEntities'
  relatedDataclass?: string
  displayMode?: 'tree' | 'form'
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  // Reloading in place (parent entity changed or manual refresh) keeps the
  // currently displayed data visible and only shows a header spinner, so the
  // content swaps without flickering once the new data arrives.
  const [isReloading, setIsReloading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [entity, setEntity] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  // Server-side entity set metadata captured when loading a related set, so it
  // can be opened in its own tab.
  const [relatedSetId, setRelatedSetId] = useState<string | null>(null)
  const [relatedModel, setRelatedModel] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const openEntitySetTab = useTabsStore((s) => s.openEntitySetTab)
  const selectDataclass = useDataExplorerStore((s) => s.selectDataclass)

  const isSet = kind === 'relatedEntities'

  const load = useCallback(
    async (mode: 'initial' | 'more' | 'reload') => {
      // For an in-place reload, keep showing the existing content and surface a
      // spinner in the header instead of flipping to the empty loading state.
      if (mode === 'reload') {
        setIsReloading(true)
      } else {
        setStatus('loading')
      }
      setErrorMsg(null)
      try {
        if (isSet) {
          const skip = mode === 'more' ? items.length : 0
          const data = await api.fetchRelated(uri, {
            top: RELATED_PAGE_SIZE,
            skip,
            subEntitySet: true,
            sort: sortColumn ?? undefined,
            order: sortOrder,
          })
          const fetched = (data.__ENTITIES as Record<string, unknown>[] | undefined) ?? []
          const count = (data.__COUNT as number | undefined) ?? fetched.length
          setTotal(count)
          setItems((prev) => (mode === 'more' ? [...prev, ...fetched] : fetched))
          setRelatedSetId(extractEntitySetId(data.__ENTITYSET) ?? null)
          setRelatedModel((data.__entityModel as string | undefined) ?? null)
        } else {
          const data = await api.fetchRelated(uri)
          setEntity(data)
        }
        setStatus('loaded')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('entity.failedToLoadRelated'))
        setStatus('error')
      } finally {
        setIsReloading(false)
      }
    },
    [isSet, items.length, uri, t, sortColumn, sortOrder]
  )

  // Header sort is server-side for related entity sets: changing sort triggers
  // an in-place reload of the current relation.
  useEffect(() => {
    if (!isSet) return
    if (status !== 'loaded') return
    load('reload')
  }, [isSet, status, load])

  const collapse = useCallback(() => {
    setStatus('idle')
    setEntity(null)
    setItems([])
    setTotal(0)
    setRelatedSetId(null)
    setRelatedModel(null)
    setSortColumn(null)
    setSortOrder('asc')
    setErrorMsg(null)
  }, [])

  const handleRelatedSortChange = useCallback((column: string | null, order: 'asc' | 'desc') => {
    setSortColumn(column)
    setSortOrder(order)
  }, [])

  // When the parent entity changes, the relation URI changes too. If this
  // relation was already expanded, reload it so it reflects the newly selected
  // entity instead of showing stale related data. Collapsed relations stay idle.
  const prevUriRef = useRef(uri)
  useEffect(() => {
    if (prevUriRef.current === uri) return
    prevUriRef.current = uri
    if (status === 'loaded' || status === 'error') {
      load('reload')
    }
  }, [uri, status, load])

  // Open the loaded related entity set in its own tab. Title mirrors the REST
  // deferred path, e.g. "Reservation[2]/alternatives". Reuses an existing tab for
  // the same entity set if one is already open instead of creating a duplicate.
  const openInTab = useCallback(() => {
    if (!relatedSetId || !relatedModel) return
    const customTitle = uri.replace(/^\/rest\//, '').split('?')[0]
    openEntitySetTab({
      dataclassName: relatedModel,
      entitySetId: relatedSetId,
      customTitle,
      viewMode: 'table',
      forceNew: false,
    })
    selectDataclass(relatedModel)
  }, [relatedSetId, relatedModel, uri, openEntitySetTab, selectDataclass])

  const RelationIcon = isSet ? Network : Link2

  // Toggle from the header: load when idle/error, collapse when loaded.
  const toggleFromHeader = useCallback(() => {
    if (status === 'loaded') collapse()
    else if (status !== 'loading') load('initial')
  }, [status, collapse, load])

  return (
    <div className="my-1 rounded-lg border border-border/60 bg-muted/20">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={toggleFromHeader}
          disabled={status === 'loading'}
          aria-expanded={status === 'loaded'}
          className="-ml-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          {status === 'loaded' ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <RelationIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium text-sm">{name}</span>
          <span className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {relatedDataclass ?? (isSet ? t('entity.relatedEntities') : t('entity.relatedEntity'))}
            {isSet && status === 'loaded' ? ` · ${total}` : ''}
          </span>
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {(status === 'loading' || isReloading) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {status === 'loaded' && (
            <>
              {isSet && relatedSetId && relatedModel && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={openInTab}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('entity.openRelatedInTab')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={() => load('reload')}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.reloadRelated')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={collapse}
                    >
                      <ChevronsDownUp className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.collapseRelated')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <div className="px-2.5 pb-2">
          <ErrorList error={errorMsg} variant="inline" />
        </div>
      )}

      {status === 'loaded' && (
        <div className="border-border/40 border-t px-2.5 py-1.5">
          {isSet ? (
            items.length === 0 ? (
              <p className="py-1 text-muted-foreground text-sm italic">
                {t('entity.noRelatedEntities')}
              </p>
            ) : (
              <>
                <RelatedEntityTable
                  items={items}
                  sortColumn={sortColumn}
                  sortOrder={sortOrder}
                  onSortChange={handleRelatedSortChange}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t('entity.relatedShowingCount', { shown: items.length, total })}
                  </span>
                  {items.length < total && relatedSetId && relatedModel && (
                    <Button type="button" variant="outline" size="xs" onClick={openInTab}>
                      <ExternalLink />
                      {t('entity.viewAllInTab')}
                    </Button>
                  )}
                </div>
              </>
            )
          ) : entity ? (
            displayMode === 'form' ? (
              <RelatedEntityForm entity={entity} />
            ) : (
              <div>
                <MetadataPanel
                  entries={Object.entries(entity).filter(([k]) => isInternalAttribute(k))}
                />
                {Object.entries(entity)
                  .filter(([k]) => !isInternalAttribute(k))
                  .map(([k, v]) => (
                    <TreeNode key={k} keyName={k} value={v} />
                  ))}
              </div>
            )
          ) : (
            <p className="py-1 text-muted-foreground text-sm italic">
              {t('entity.noRelatedEntity')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
