import { Button, cn, Input } from '@4d/ui'
import { Check, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { TagInput } from '~/components/Tags'
import { useTranslation } from '~/i18n'
import {
  type FavouriteMeta,
  MAX_FAVOURITE_NAME_LENGTH,
  normalizeFavouriteTags,
} from '~/store/favourite-meta'
import { useUsedTagsStore } from '~/store/used-tags'

/**
 * Inline name + tags editor for a favourites row — replaces the modal dialog
 * with a dense strip that stays in list context.
 */
export function FavouriteInlineMetaEditor({
  initialName,
  initialTags,
  onSave,
  onCancel,
}: {
  initialName?: string
  initialTags?: string[]
  onSave: (meta: FavouriteMeta) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const nameId = useId()
  const tagsId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const registerTags = useUsedTagsStore((state) => state.registerTags)
  const [name, setName] = useState(initialName ?? '')
  const [tags, setTags] = useState<string[]>(() => normalizeFavouriteTags(initialTags))

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const handleSave = () => {
    const nextTags = normalizeFavouriteTags(tags)
    registerTags(nextTags)
    onSave({ name, tags: nextTags })
  }

  return (
    <div
      className={cn(
        'relative border-border/50 border-b bg-muted/25 px-2 py-2',
        'before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary/70'
      )}
    >
      <div className="flex items-start gap-2 pl-1.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor={nameId} className="sr-only">
              {t('favouriteMeta.name')}
            </label>
            <Input
              ref={nameRef}
              id={nameId}
              value={name}
              maxLength={MAX_FAVOURITE_NAME_LENGTH}
              placeholder={t('favouriteMeta.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSave()
                }
              }}
              className="h-7 border-border/60 bg-background/80 font-sans text-xs shadow-none focus-visible:ring-1"
            />
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onCancel}
                aria-label={t('common.cancel')}
                title={t('common.cancel')}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-7 w-7"
                onClick={handleSave}
                aria-label={t('common.save')}
                title={t('common.save')}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <label htmlFor={tagsId} className="sr-only">
            {t('favouriteMeta.tags')}
          </label>
          <TagInput
            id={tagsId}
            value={tags}
            onChange={setTags}
            placeholder={t('tags.placeholder')}
            dense
          />
        </div>
      </div>
    </div>
  )
}
