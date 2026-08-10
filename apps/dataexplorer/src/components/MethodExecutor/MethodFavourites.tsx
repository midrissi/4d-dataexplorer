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
  methodSeedExportLabel,
  methodSeedToPostmanItem,
  type PostmanExportItemInput,
} from '~/lib/postman'
import type { MethodFavourite } from '~/store/method-favourites'
import { useUsedTagsStore } from '~/store/used-tags'
import { MethodSeedExpression } from './MethodSeedExpression'
import {
  cnMethodScopeBadge,
  methodArgCountMeta,
  methodScopeShortLabel,
} from './method-list-display'

function toPostmanExportItems(favourites: MethodFavourite[]): PostmanExportItemInput[] {
  return favourites.map((favourite) => {
    const fallback = methodSeedExportLabel(favourite.config)
    const displayName = favourite.name?.trim() || undefined
    const name = displayName || fallback
    const tags = favourite.tags
    const description = tags?.length ? tags.join(', ') : undefined
    return {
      id: favourite.id,
      name,
      displayName,
      listDetail: fallback,
      badgeLabel: methodScopeShortLabel(favourite.config.scope),
      badgeClassName: cn(cnMethodScopeBadge(favourite.config.scope), 'normal-case'),
      description,
      tags,
      item: methodSeedToPostmanItem(favourite.config, { name, description }),
    }
  })
}

function FavouriteRow({
  favourite,
  editing,
  onOpen,
  onRemove,
  onEdit,
  onDuplicate,
  onSaveMeta,
  onCancelEdit,
  activeTag,
  onTagClick,
}: {
  favourite: MethodFavourite
  editing: boolean
  onOpen: () => void
  onRemove: () => void
  onEdit: () => void
  onDuplicate: () => void
  onSaveMeta: (meta: { name?: string; tags?: string[] }) => void
  onCancelEdit: () => void
  activeTag: string | null
  onTagClick: (tag: string) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const argCount = favourite.config.arguments?.length ?? 0
  const argMeta = methodArgCountMeta(argCount, t)
  const absoluteTime = new Date(favourite.createdAt).toLocaleString()
  const signature = <MethodSeedExpression config={favourite.config} />

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
        <SavedListBadge className={cn(cnMethodScopeBadge(favourite.config.scope), 'normal-case')}>
          {methodScopeShortLabel(favourite.config.scope)}
        </SavedListBadge>
      }
      primary={
        <FavouritePrimaryLabel
          name={favourite.name}
          detail={signature}
          signatureLabel={t('favouriteMeta.viewSignature')}
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
      onDuplicate={onDuplicate}
      duplicateLabel={t('favouriteMeta.duplicate')}
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
  onDuplicateFavourite,
  onClose,
}: {
  favourites: MethodFavourite[]
  onOpenFavourite: (favourite: MethodFavourite) => void
  onRemoveFavourite: (id: string) => void
  onClearFavourites: () => void
  onUpdateFavouriteMeta: (id: string, meta: { name?: string; tags?: string[] }) => void
  onDuplicateFavourite: (id: string) => string | null
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

  const confirmRemove = async (favourite: MethodFavourite) => {
    const label = favourite.name?.trim() || favourite.config.methodName
    const ok = await confirm({
      title: t('favouriteMeta.removeConfirmTitle'),
      description: t('favouriteMeta.removeConfirmDescription', { name: label }),
      confirmText: t('methodExecutor.removeFavourite'),
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
        title={t('methodExecutor.favourites')}
        titleId={mobile ? 'method-favourites-title' : undefined}
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
            {t('methodExecutor.exportToPostman')}
          </Button>
        }
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
              editing={editingId === favourite.id}
              onOpen={() => onOpenFavourite(favourite)}
              onRemove={() => {
                void confirmRemove(favourite)
              }}
              onEdit={() => setEditingId(favourite.id)}
              onDuplicate={() => {
                const id = onDuplicateFavourite(favourite.id)
                if (id) setEditingId(id)
              }}
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
        defaultCollectionName={t('postmanExport.defaultMethodName')}
        signatureLabel={t('favouriteMeta.viewSignature')}
      />
      <ConfirmDialog />
    </>
  )
}
