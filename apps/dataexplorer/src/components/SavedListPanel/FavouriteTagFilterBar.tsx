import { Button } from '@4d/ui'
import { TagChipButton } from '~/components/Tags'
import { useTranslation } from '~/i18n'

/** Tag chips used to filter favourites lists. */
export function FavouriteTagFilterBar({
  tags,
  activeTag,
  onChange,
}: {
  tags: string[]
  activeTag: string | null
  onChange: (tag: string | null) => void
}) {
  const { t } = useTranslation()
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 border-border/50 border-b bg-muted/15 px-2 py-1">
      <Button
        variant={activeTag == null ? 'secondary' : 'ghost'}
        size="sm"
        className="h-3.5 px-1.5 text-[9px]"
        onClick={() => onChange(null)}
      >
        {t('favouriteMeta.filterAll')}
      </Button>
      {tags.map((tag) => (
        <TagChipButton
          key={tag.toLowerCase()}
          tag={tag}
          active={activeTag?.toLowerCase() === tag.toLowerCase()}
          onClick={() => onChange(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)}
        />
      ))}
    </div>
  )
}
