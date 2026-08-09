import { Input, Label, SegmentedControl, Textarea } from '@4d/ui'
import { Layers, List } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { PostmanFolderMode } from '~/lib/postman'

export function PostmanExportCollectionForm({
  collectionName,
  onCollectionNameChange,
  collectionDescription,
  onCollectionDescriptionChange,
  folderMode,
  onFolderModeChange,
}: {
  collectionName: string
  onCollectionNameChange: (value: string) => void
  collectionDescription: string
  onCollectionDescriptionChange: (value: string) => void
  folderMode: PostmanFolderMode
  onFolderModeChange: (value: PostmanFolderMode) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t('postmanExport.collectionSectionHelp')}
      </p>

      <div className="space-y-1.5 rounded-md bg-muted/20 p-2">
        <div className="space-y-0.5">
          <Label htmlFor="postman-collection-name" className="text-xs">
            {t('postmanExport.collectionName')}
          </Label>
          <Input
            id="postman-collection-name"
            className="h-7 text-sm"
            value={collectionName}
            onChange={(event) => onCollectionNameChange(event.target.value)}
            placeholder={t('postmanExport.collectionNamePlaceholder')}
          />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="postman-collection-description" className="text-xs">
            {t('postmanExport.collectionDescription')}
          </Label>
          <Textarea
            id="postman-collection-description"
            value={collectionDescription}
            onChange={(event) => onCollectionDescriptionChange(event.target.value)}
            placeholder={t('postmanExport.collectionDescriptionPlaceholder')}
            rows={2}
            className="min-h-12 resize-y text-sm"
          />
        </div>
      </div>

      <div className="space-y-1 rounded-md bg-sky-500/5 p-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label className="text-foreground text-xs">{t('postmanExport.folderMode')}</Label>
          <span className="text-[10px] text-muted-foreground">
            {t('postmanExport.folderModeHint')}
          </span>
        </div>
        <SegmentedControl
          aria-label={t('postmanExport.folderMode')}
          value={folderMode}
          onValueChange={onFolderModeChange}
          fullWidth
          size="sm"
          options={[
            {
              value: 'flat',
              label: t('postmanExport.folderModeFlat'),
              icon: List,
            },
            {
              value: 'byTags',
              label: t('postmanExport.folderModeByTags'),
              icon: Layers,
            },
          ]}
        />
      </div>
    </div>
  )
}
