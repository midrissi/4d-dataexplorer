import { Checkbox, SegmentedControl } from '@4d/ui'
import { useTranslation } from '~/i18n'
import type { ToolkitEmojiConfig } from '~/lib/rest-export'

export function RestExportEmojiToolbar({
  emoji,
  includeDocs,
  onEnabledChange,
  onDataclassFolderEmojiChange,
  onIncludeDocsChange,
}: {
  emoji: ToolkitEmojiConfig
  includeDocs: boolean
  onEnabledChange: (enabled: boolean) => void
  onDataclassFolderEmojiChange: (value: boolean) => void
  onIncludeDocsChange: (includeDocs: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {t('restExportBuilder.emojiLabel')}
        </span>
        <SegmentedControl
          aria-label={t('restExportBuilder.emojiLabel')}
          value={emoji.enabled ? 'on' : 'off'}
          onValueChange={(value) => onEnabledChange(value === 'on')}
          options={[
            { value: 'off', label: t('restExportBuilder.emojiOff') },
            { value: 'on', label: t('restExportBuilder.emojiOn') },
          ]}
        />
      </div>
      <label
        className="flex cursor-pointer items-center gap-1.5 text-xs"
        htmlFor="rest-export-dataclass-folder-emoji"
      >
        <Checkbox
          id="rest-export-dataclass-folder-emoji"
          checked={emoji.dataclassFolderEmoji}
          disabled={!emoji.enabled}
          onCheckedChange={(value) => onDataclassFolderEmojiChange(value === true)}
        />
        <span className={emoji.enabled ? 'text-foreground' : 'text-muted-foreground'}>
          {t('restExportBuilder.dataclassFolderEmoji')}
        </span>
      </label>
      <div className="flex items-center gap-2">
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {t('restExportBuilder.docsLabel')}
        </span>
        <SegmentedControl
          aria-label={t('restExportBuilder.docsLabel')}
          value={includeDocs ? 'on' : 'off'}
          onValueChange={(value) => onIncludeDocsChange(value === 'on')}
          options={[
            { value: 'off', label: t('restExportBuilder.docsOff') },
            { value: 'on', label: t('restExportBuilder.docsOn') },
          ]}
        />
      </div>
    </div>
  )
}
