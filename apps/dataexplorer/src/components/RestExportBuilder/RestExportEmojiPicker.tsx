import { cn, EmojiPicker, type EmojiPickerLabels } from '@4d/ui'
import { Plus } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { emojiForKey, type ToolkitEmojiConfig, type ToolkitEmojiKey } from '~/lib/rest-export'

export function RestExportEmojiPicker({
  emojiKey,
  emoji,
  onChange,
}: {
  emojiKey: ToolkitEmojiKey
  emoji: ToolkitEmojiConfig
  onChange: (key: ToolkitEmojiKey, next: string, options?: { category?: boolean }) => void
}) {
  const { t } = useTranslation()
  const current = emojiForKey(emojiKey, emoji)
  const triggerLabel = current
    ? t('restExportBuilder.changeEmoji')
    : t('restExportBuilder.addEmoji')
  const labels: EmojiPickerLabels = {
    title: t('restExportBuilder.chooseEmoji'),
    search: t('restExportBuilder.emojiSearch'),
    searchPlaceholder: t('restExportBuilder.emojiSearchPlaceholder'),
    clear: t('restExportBuilder.noEmoji'),
    empty: t('restExportBuilder.emojiEmpty'),
    categories: {
      professional: t('restExportBuilder.emojiCategoryProfessional'),
      smileys: t('restExportBuilder.emojiCategorySmileys'),
      people: t('restExportBuilder.emojiCategoryPeople'),
      nature: t('restExportBuilder.emojiCategoryNature'),
      food: t('restExportBuilder.emojiCategoryFood'),
      activity: t('restExportBuilder.emojiCategoryActivity'),
      travel: t('restExportBuilder.emojiCategoryTravel'),
      objects: t('restExportBuilder.emojiCategoryObjects'),
      symbols: t('restExportBuilder.emojiCategorySymbols'),
      flags: t('restExportBuilder.emojiCategoryFlags'),
    },
  }

  return (
    <EmojiPicker
      value={current}
      labels={labels}
      defaultCategory="professional"
      hint={t('restExportBuilder.emojiShiftHint')}
      triggerAriaLabel={triggerLabel}
      onSelect={(next, modifiers) =>
        onChange(emojiKey, next, modifiers.shiftKey ? { category: true } : undefined)
      }
      onClear={(modifiers) =>
        onChange(emojiKey, '', modifiers.shiftKey ? { category: true } : undefined)
      }
    >
      <button
        type="button"
        className={cn(
          'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-0.5 text-[13px] leading-none',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          current ? 'text-foreground/80' : 'text-muted-foreground/55 hover:text-muted-foreground'
        )}
        aria-label={triggerLabel}
        title={triggerLabel}
        onPointerDown={(event) => {
          if (!event.shiftKey) return
          event.preventDefault()
          event.stopPropagation()
          onChange(emojiKey, current, { category: true })
        }}
      >
        {current ? current : <Plus className="h-3 w-3" aria-hidden />}
      </button>
    </EmojiPicker>
  )
}
