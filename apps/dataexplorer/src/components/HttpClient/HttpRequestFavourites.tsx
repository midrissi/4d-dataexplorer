import { cn, useConfirm } from '@4d/ui'
import { Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import type { HttpClientSeed } from '~/store/http-client-types'
import type { HttpRequestFavourite } from '~/store/http-request-favourites'
import { useUsedTagsStore } from '~/store/used-tags'
import { httpMethodTone, httpRequestLabel } from './http-request-display'

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

  useEffect(() => {
    registerTags(favourites.flatMap((favourite) => favourite.tags ?? []))
  }, [favourites, registerTags])

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
      <ConfirmDialog />
    </>
  )
}
