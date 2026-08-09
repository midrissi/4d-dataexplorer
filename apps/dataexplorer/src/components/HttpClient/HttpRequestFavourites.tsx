import { Button, cn, useConfirm } from '@4d/ui'
import { Download, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PostmanExportModal } from '~/components/PostmanExport'
import {
  FavouriteInlineMetaEditor,
  FavouritePrimaryLabel,
  FavouriteTagFilterBar,
  formatRelativeTime,
  SavedListBadge,
  SavedListPanel,
  SavedListRow,
} from '~/components/SavedListPanel'
import { TagList } from '~/components/Tags'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import {
  httpSeedExportLabel,
  httpSeedToPostmanItem,
  type PostmanExportItemInput,
} from '~/lib/postman'
import type { HttpClientSeed } from '~/store/http-client-types'
import type { HttpRequestFavourite } from '~/store/http-request-favourites'
import { useUsedTagsStore } from '~/store/used-tags'
import { httpMethodTone, httpRequestLabel } from './http-request-display'

function toPostmanExportItems(favourites: HttpRequestFavourite[]): PostmanExportItemInput[] {
  return favourites.map((favourite) => {
    const { method, path, fullUrl, isCustomOrigin } = httpRequestLabel(favourite.seed)
    const methodStyles = httpMethodTone(method)
    const fallback = isCustomOrigin ? fullUrl : path || httpSeedExportLabel(favourite.seed)
    const displayName = favourite.name?.trim() || undefined
    const name = displayName || fallback
    const tags = favourite.tags
    const description = tags?.length ? tags.join(', ') : undefined
    return {
      id: favourite.id,
      name,
      displayName,
      listDetail: fallback,
      badgeLabel: method,
      badgeClassName: cn(methodStyles.bg, methodStyles.text),
      description,
      tags,
      item: httpSeedToPostmanItem(favourite.seed, { name, description }),
    }
  })
}

function FavouriteRequestRow({
  favourite,
  editing,
  onOpen,
  onRemove,
  onEdit,
  onSaveMeta,
  onCancelEdit,
  activeTag,
  onTagClick,
}: {
  favourite: HttpRequestFavourite
  editing: boolean
  onOpen: () => void
  onRemove: () => void
  onEdit: () => void
  onSaveMeta: (meta: { name?: string; tags?: string[] }) => void
  onCancelEdit: () => void
  activeTag: string | null
  onTagClick: (tag: string) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { method, path, fullUrl, isCustomOrigin } = httpRequestLabel(favourite.seed)
  const methodStyles = httpMethodTone(method)
  const absoluteTime = new Date(favourite.createdAt).toLocaleString()
  const detail = isCustomOrigin ? fullUrl : path

  if (editing) {
    return (
      <FavouriteInlineMetaEditor
        initialName={favourite.name}
        initialTags={favourite.tags}
        onSave={onSaveMeta}
        onCancel={onCancelEdit}
      />
    )
  }

  return (
    <SavedListRow
      badge={
        <SavedListBadge className={cn(methodStyles.bg, methodStyles.text)}>{method}</SavedListBadge>
      }
      primary={
        <FavouritePrimaryLabel
          name={favourite.name}
          detail={<span className={cn(isCustomOrigin && 'text-muted-foreground')}>{detail}</span>}
          signatureLabel={t('favouriteMeta.viewPath')}
        />
      }
      primaryClassName={favourite.name ? 'overflow-hidden' : 'truncate'}
      primaryTitle={favourite.name ? `${favourite.name} — ${fullUrl}` : fullUrl}
      meta={
        <>
          {favourite.tags?.length ? (
            <TagList tags={favourite.tags} max={2} activeTag={activeTag} onTagClick={onTagClick} />
          ) : null}
          {!mobile ? (
            <span
              className="w-14 shrink-0 truncate text-right text-[10px] text-muted-foreground/80 tabular-nums"
              title={absoluteTime}
            >
              {formatRelativeTime(favourite.createdAt)}
            </span>
          ) : null}
        </>
      }
      onEdit={onEdit}
      editLabel={t('favouriteMeta.edit')}
      onRemove={onRemove}
      removeLabel={t('httpClient.removeFavourite')}
      removeMode="star"
      onOpen={onOpen}
    />
  )
}

export function HttpRequestFavourites({
  favourites,
  onOpenFavourite,
  onRemoveFavourite,
  onClearFavourites,
  onUpdateFavouriteMeta,
  onClose,
}: {
  favourites: HttpRequestFavourite[]
  onOpenFavourite: (seed: HttpClientSeed) => void
  onRemoveFavourite: (id: string) => void
  onClearFavourites: () => void
  onUpdateFavouriteMeta: (id: string, meta: { name?: string; tags?: string[] }) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { confirm, ConfirmDialog } = useConfirm()
  const registerTags = useUsedTagsStore((state) => state.registerTags)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    registerTags(favourites.flatMap((favourite) => favourite.tags ?? []))
  }, [favourites, registerTags])

  const exportItems = useMemo(() => toPostmanExportItems(favourites), [favourites])

  const allTags = useMemo(() => {
    const seen = new Map<string, string>()
    for (const favourite of favourites) {
      for (const tag of favourite.tags ?? []) {
        const key = tag.toLowerCase()
        if (!seen.has(key)) seen.set(key, tag)
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [favourites])

  const visible = useMemo(() => {
    if (!activeTag) return favourites
    const key = activeTag.toLowerCase()
    return favourites.filter((favourite) =>
      favourite.tags?.some((tag) => tag.toLowerCase() === key)
    )
  }, [favourites, activeTag])

  const confirmRemove = async (favourite: HttpRequestFavourite) => {
    const { path, fullUrl } = httpRequestLabel(favourite.seed)
    const label = favourite.name?.trim() || path || fullUrl
    const ok = await confirm({
      title: t('favouriteMeta.removeConfirmTitle'),
      description: t('favouriteMeta.removeConfirmDescription', { name: label }),
      confirmText: t('httpClient.removeFavourite'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    })
    if (!ok) return
    if (editingId === favourite.id) setEditingId(null)
    onRemoveFavourite(favourite.id)
  }

  return (
    <>
      <SavedListPanel
        icon={Star}
        title={t('httpClient.favourites')}
        titleId={mobile ? 'http-request-favourites-title' : undefined}
        count={favourites.length}
        headerExtra={
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-2 text-[11px] text-muted-foreground', mobile && 'h-9 text-xs')}
            onClick={() => setExportOpen(true)}
            disabled={favourites.length === 0}
          >
            <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t('httpClient.exportToPostman')}
          </Button>
        }
        clearLabel={t('httpClient.clearAll')}
        onClear={onClearFavourites}
        clearConfirm={{
          title: t('httpClient.clearFavouritesTitle'),
          description: t('httpClient.clearFavouritesDescription'),
          confirmText: t('httpClient.clearAll'),
          cancelText: t('common.cancel'),
        }}
        emptyTitle={t('httpClient.noFavouritesTitle')}
        emptyDescription={t('httpClient.noFavouritesDescription')}
        onClose={onClose}
      >
        <FavouriteTagFilterBar tags={allTags} activeTag={activeTag} onChange={setActiveTag} />
        {visible.length === 0 && favourites.length > 0 ? (
          <p className="px-3 py-4 text-center text-muted-foreground text-xs">
            {t('favouriteMeta.noTagMatches')}
          </p>
        ) : (
          visible.map((favourite) => (
            <FavouriteRequestRow
              key={favourite.id}
              favourite={favourite}
              editing={editingId === favourite.id}
              onOpen={() => onOpenFavourite(favourite.seed)}
              onRemove={() => {
                void confirmRemove(favourite)
              }}
              onEdit={() => setEditingId(favourite.id)}
              onSaveMeta={(meta) => {
                onUpdateFavouriteMeta(favourite.id, meta)
                setEditingId(null)
              }}
              onCancelEdit={() => setEditingId(null)}
              activeTag={activeTag}
              onTagClick={(tag) =>
                setActiveTag((current) =>
                  current?.toLowerCase() === tag.toLowerCase() ? null : tag
                )
              }
            />
          ))
        )}
      </SavedListPanel>
      <PostmanExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        items={exportItems}
        defaultCollectionName={t('postmanExport.defaultHttpName')}
        signatureLabel={t('favouriteMeta.viewPath')}
      />
      <ConfirmDialog />
    </>
  )
}
