import { Button, cn, Input, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import { Dices, Palette, Search } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { VirtualIconGrid } from '~/components/VirtualIconGrid'
import { useTranslation } from '~/i18n'
import { COLOR_PRESETS, type ColorPreset, ICON_PRESETS, type Profile } from '~/store/settings'

type ProfileAppearancePopoverProps = {
  profile: Profile
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateAppearance: (updates: { icon?: string; color?: string }) => void
}

export function ProfileAppearancePopover({
  profile,
  open,
  onOpenChange,
  onUpdateAppearance,
}: ProfileAppearancePopoverProps) {
  const { t } = useTranslation()
  const selectedColorRef = useRef<HTMLButtonElement>(null)
  const [iconSearch, setIconSearch] = useState('')
  const [iconScrollNonce, setIconScrollNonce] = useState(0)
  const deferredIconSearch = useDeferredValue(iconSearch)

  const filteredIcons = useMemo(() => {
    if (!deferredIconSearch.trim()) return ICON_PRESETS
    const query = deferredIconSearch.toLowerCase()
    return ICON_PRESETS.filter((icon) => icon.toLowerCase().includes(query))
  }, [deferredIconSearch])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setIconSearch('')
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const handleRandom = useCallback(() => {
    const randomIcon = ICON_PRESETS[Math.floor(Math.random() * ICON_PRESETS.length)]
    const colorKeys = Object.keys(COLOR_PRESETS).filter((key) => key !== 'default')
    const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)]
    onUpdateAppearance({ icon: randomIcon, color: randomColor })
    setIconScrollNonce((n) => n + 1)
    setTimeout(() => {
      selectedColorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
  }, [onUpdateAppearance])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground"
          title={t('settings.profileIconAndColor')}
        >
          <Palette className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="mb-2 font-medium text-muted-foreground text-xs">
          {t('settings.profileIconAndColor')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-2 h-7 w-full gap-1.5 text-xs"
          onClick={handleRandom}
          title={t('settings.randomIconAndColor')}
        >
          <Dices className="h-3.5 w-3.5" />
          {t('settings.randomize')}
        </Button>
        <div className="relative mb-2">
          <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('settings.searchIcons')}
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <VirtualIconGrid
          icons={filteredIcons}
          value={profile.icon}
          onSelect={(icon) => onUpdateAppearance({ icon })}
          height={200}
          cellSize={32}
          className="mb-2"
          scrollNonce={iconScrollNonce}
        />
        <p className="mb-2 text-[10px] text-muted-foreground">
          {t('settings.iconCatalogCount', { count: filteredIcons.length })}
        </p>
        <div className="scrollbar-none flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-lg border p-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(
            Object.entries(COLOR_PRESETS) as [ColorPreset, (typeof COLOR_PRESETS)[ColorPreset]][]
          ).map(([key, preset]) => {
            const isSelected = profile.color === key
            return (
              <Button
                type="button"
                key={key}
                ref={isSelected ? selectedColorRef : undefined}
                variant="outline"
                size="sm"
                className={cn(
                  'h-6! w-6! min-w-0! rounded-full p-0',
                  isSelected && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => onUpdateAppearance({ color: key })}
                title={t(preset.nameKey)}
              >
                <div
                  className={cn(
                    'h-3 w-3 rounded-full',
                    key === 'default' ? 'bg-primary' : preset.bg
                  )}
                />
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
