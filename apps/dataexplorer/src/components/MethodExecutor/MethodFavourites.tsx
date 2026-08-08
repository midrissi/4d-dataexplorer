import { cn } from '@4d/ui'
import { Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  FavouriteMetaDialog,
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
import type { MethodExecutorSeed } from '~/store/method-executor-types'
import type { MethodFavourite } from '~/store/method-favourites'
import { useUsedTagsStore } from '~/store/used-tags'
import { MethodSeedExpression } from './MethodSeedExpression'
import {
  cnMethodScopeBadge,
  methodArgCountMeta,
  methodScopeShortLabel,
} from './method-list-display'

function FavouriteRow({
  favourite,
  onOpen,
  onRemove,
  onEdit,
  activeTag,
  onTagClick,
}: {
  favourite: MethodFavourite
  onOpen: () => void
  onRemove: () => void
  onEdit: () => void
  activeTag: string | null
  onTagClick: (tag: string) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const argCount = favourite.config.arguments?.length ?? 0
  const argMeta = methodArgCountMeta(argCount, t)
  const absoluteTime = new Date(favourite.createdAt).toLocaleString()

  return (
    <SavedListRow
      badge={
        <SavedListBadge className={cn(cnMethodScopeBadge(favourite.config.scope), 'normal-case')}>
          {methodScopeShortLabel(favourite.config.scope)}
        </SavedListBadge>
      }
      primary={
        <FavouritePrimaryLabel
          name={favourite.name}
          detail={<MethodSeedExpression config={favourite.config} />}
        />
      }
      primaryClassName={favourite.name ? 'overflow-hidden' : undefined}
      primaryTitle={favourite.name}
      meta={
        <>
          {favourite.tags?.length ? (
            <TagList tags={favourite.tags} max={2} activeTag={activeTag} onTagClick={onTagClick} />
          ) : null}
          {argMeta ? (
            <span className="hidden text-[10px] text-muted-foreground sm:inline">{argMeta}</span>
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
      removeLabel={t('methodExecutor.removeFavourite')}
      removeMode="star"
      onOpen={onOpen}
    />
  )
}

export function MethodFavourites({
  favourites,
  onOpenFavourite,
  onRemoveFavourite,
  onClearFavourites,
  onUpdateFavouriteMeta,
  onClose,
}: {
  favourites: MethodFavourite[]
  onOpenFavourite: (config: MethodExecutorSeed) => void
  onRemoveFavourite: (id: string) => void
  onClearFavourites: () => void
  onUpdateFavouriteMeta: (id: string, meta: { name?: string; tags?: string[] }) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const registerTags = useUsedTagsStore((state) => state.registerTags)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<MethodFavourite | null>(null)

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

  return (
    <>
      <SavedListPanel
        icon={Star}
        title={t('methodExecutor.favourites')}
        titleId={mobile ? 'method-favourites-title' : undefined}
        count={favourites.length}
        clearLabel={t('methodExecutor.clearAll')}
        onClear={onClearFavourites}
        clearConfirm={{
          title: t('methodExecutor.clearFavouritesTitle'),
          description: t('methodExecutor.clearFavouritesDescription'),
          confirmText: t('methodExecutor.clearAll'),
          cancelText: t('methodExecutor.cancel'),
        }}
        emptyTitle={t('methodExecutor.noFavouritesTitle')}
        emptyDescription={t('methodExecutor.noFavouritesDescription')}
        onClose={onClose}
      >
        <FavouriteTagFilterBar tags={allTags} activeTag={activeTag} onChange={setActiveTag} />
        {visible.length === 0 && favourites.length > 0 ? (
          <p className="px-3 py-4 text-center text-muted-foreground text-xs">
            {t('favouriteMeta.noTagMatches')}
          </p>
        ) : (
          visible.map((favourite) => (
            <FavouriteRow
              key={favourite.id}
              favourite={favourite}
              onOpen={() => onOpenFavourite(favourite.config)}
              onRemove={() => onRemoveFavourite(favourite.id)}
              onEdit={() => setEditing(favourite)}
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

      <FavouriteMetaDialog
        open={editing != null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        initialName={editing?.name}
        initialTags={editing?.tags}
        onSave={(meta) => {
          if (!editing) return
          onUpdateFavouriteMeta(editing.id, meta)
          setEditing(null)
        }}
      />
    </>
  )
}
