import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@4d/ui'
import { Database, Dices, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { VirtualIconGrid } from '~/components/VirtualIconGrid'
import { useTranslation } from '~/i18n'
import { resolveLucideIcon } from '~/lib/lucide-icon'
import { mobileCenteredDialogClass } from '~/lib/mobile-menu'
import { COLOR_PRESETS, type ColorPreset, ICON_PRESETS } from '~/store/settings'

export type MobileConnectionAppearanceProps = {
  icon: string
  color: ColorPreset
  iconScrollNonce: number
  onIconChange: (icon: string) => void
  onColorChange: (color: ColorPreset) => void
  onRandomize: () => void
}

export function MobileConnectionAppearance({
  icon,
  color,
  iconScrollNonce,
  onIconChange,
  onColorChange,
  onRandomize,
}: MobileConnectionAppearanceProps) {
  const { t } = useTranslation()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const deferredIconSearch = useDeferredValue(iconSearch)
  const SelectedIcon = resolveLucideIcon(icon) ?? Database

  const filteredIcons = useMemo(() => {
    if (!deferredIconSearch.trim()) return ICON_PRESETS
    const query = deferredIconSearch.toLowerCase()
    return ICON_PRESETS.filter((name) => name.toLowerCase().includes(query))
  }, [deferredIconSearch])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t('connectionScreen.formAppearanceLabel')}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-muted-foreground text-sm"
          onClick={onRandomize}
        >
          <Dices className="h-4 w-4" aria-hidden />
          {t('connectionScreen.formRandomize')}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-16 w-16 shrink-0 rounded-2xl p-1.5"
          aria-label={t('connectionScreen.formChooseIcon')}
          onClick={() => setIconPickerOpen(true)}
        >
          <span
            className={cn(
              'flex h-full w-full items-center justify-center rounded-xl shadow-xs',
              COLOR_PRESETS[color].bg
            )}
          >
            <SelectedIcon className="h-7 w-7 text-white" aria-hidden />
          </span>
        </Button>
        <p className="min-w-0 flex-1 text-muted-foreground text-xs leading-snug">
          {t('connectionScreen.formChooseIcon')}
        </p>
      </div>

      <div
        className="-m-0.5 flex flex-wrap gap-2.5 p-0.5"
        role="listbox"
        aria-label={t('connectionScreen.formAppearanceLabel')}
      >
        {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((key) => {
          const selected = color === key
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={t(COLOR_PRESETS[key].nameKey)}
              title={t(COLOR_PRESETS[key].nameKey)}
              onClick={() => onColorChange(key)}
              className={cn(
                'h-9 w-9 shrink-0 rounded-full border border-border/60 transition-transform active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                COLOR_PRESETS[key].bg,
                selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
              )}
            />
          )
        })}
      </div>

      <Dialog
        open={iconPickerOpen}
        onOpenChange={(open) => {
          setIconPickerOpen(open)
          if (!open) setIconSearch('')
        }}
      >
        <DialogContent
          className={mobileCenteredDialogClass(
            'flex max-h-[min(85dvh,36rem)] flex-col gap-3 overflow-hidden p-4'
          )}
        >
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle>{t('connectionScreen.formChooseIcon')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('connectionScreen.formSearchIcons')}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder={t('connectionScreen.formSearchIcons')}
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              className="h-11 pl-9 text-base"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
            />
          </div>
          <VirtualIconGrid
            icons={filteredIcons}
            value={icon}
            onSelect={(next) => {
              onIconChange(next)
              setIconPickerOpen(false)
              setIconSearch('')
            }}
            height={280}
            columns={5}
            cellSize={52}
            scrollNonce={iconScrollNonce}
          />
          <p className="text-muted-foreground text-xs">
            {t('settings.iconCatalogCount', { count: filteredIcons.length })}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
