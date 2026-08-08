import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@4d/ui'
import { useEffect, useId, useState } from 'react'
import { TagInput } from '~/components/Tags'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import {
  type FavouriteMeta,
  MAX_FAVOURITE_NAME_LENGTH,
  normalizeFavouriteTags,
} from '~/store/favourite-meta'
import { useUsedTagsStore } from '~/store/used-tags'

export function FavouriteMetaDialog({
  open,
  onOpenChange,
  initialName,
  initialTags,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  initialTags?: string[]
  onSave: (meta: FavouriteMeta) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const nameId = useId()
  const tagsId = useId()
  const registerTags = useUsedTagsStore((state) => state.registerTags)
  const [name, setName] = useState(initialName ?? '')
  const [tags, setTags] = useState<string[]>(() => normalizeFavouriteTags(initialTags))

  useEffect(() => {
    if (!open) return
    setName(initialName ?? '')
    setTags(normalizeFavouriteTags(initialTags))
  }, [open, initialName, initialTags])

  const handleSave = () => {
    const nextTags = normalizeFavouriteTags(tags)
    registerTags(nextTags)
    onSave({
      name,
      tags: nextTags,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={mobile ? 'max-w-[calc(100vw-1.5rem)]' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{t('favouriteMeta.editTitle')}</DialogTitle>
          <DialogDescription>{t('favouriteMeta.editDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>{t('favouriteMeta.name')}</Label>
            <Input
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
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={tagsId}>{t('favouriteMeta.tags')}</Label>
            <TagInput
              id={tagsId}
              value={tags}
              onChange={setTags}
              placeholder={t('tags.placeholder')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
