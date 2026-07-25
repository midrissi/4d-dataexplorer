import { Button, cn, Dialog, DialogContent, DialogTitle, Input, Label } from '@4d/ui'
import { Dices, Palette, RotateCcw, Search, Smile } from 'lucide-react'
import {
  type CSSProperties,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { VirtualIconGrid } from '~/components/VirtualIconGrid'
import { useTranslation } from '~/i18n'
import { looksLikeLucideIconName, resolveLucideIcon } from '~/lib/lucide-icon'
import {
  COLOR_PRESETS,
  type ColorPreset,
  type DataclassCustomization,
  ICON_PRESETS,
  useSettingsStore,
} from '~/store/settings'

type DataclassCustomizeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataclassName: string
  currentCustomization?: DataclassCustomization
}

export function DataclassCustomizeModal({
  open,
  onOpenChange,
  dataclassName,
  currentCustomization,
}: DataclassCustomizeModalProps) {
  const { t } = useTranslation()
  const setDataclassCustomization = useSettingsStore((s) => s.setDataclassCustomization)
  const removeDataclassCustomization = useSettingsStore((s) => s.removeDataclassCustomization)

  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(currentCustomization?.icon)
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    currentCustomization?.color
  )
  const [description, setDescription] = useState(currentCustomization?.description ?? '')
  const [iconSearch, setIconSearch] = useState('')
  const [colorSearch, setColorSearch] = useState('')
  const [iconScrollNonce, setIconScrollNonce] = useState(0)

  // Ref for scrolling to selected color
  const selectedColorRef = useRef<HTMLButtonElement>(null)

  // Scroll to selected color when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        selectedColorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Reset form when modal opens with new data
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setSelectedIcon(currentCustomization?.icon)
        setSelectedColor(currentCustomization?.color)
        setDescription(currentCustomization?.description ?? '')
        setIconSearch('')
        setColorSearch('')
      }
      onOpenChange(open)
    },
    [currentCustomization, onOpenChange]
  )

  const deferredIconSearch = useDeferredValue(iconSearch)

  // Filter icons based on search (full Lucide catalog; featured sorted first in ICON_PRESETS)
  const filteredIcons = useMemo(() => {
    if (!deferredIconSearch.trim()) return ICON_PRESETS
    const query = deferredIconSearch.toLowerCase()
    return ICON_PRESETS.filter((icon) => icon.toLowerCase().includes(query))
  }, [deferredIconSearch])

  // Filter colors based on search (by key or translated name)
  const filteredColors = useMemo(() => {
    const entries = Object.entries(COLOR_PRESETS) as [string, (typeof COLOR_PRESETS)[ColorPreset]][]
    if (!colorSearch.trim()) return entries
    const query = colorSearch.toLowerCase()
    return entries.filter(([key, preset]) => {
      const displayName = t(preset.nameKey)
      return key.toLowerCase().includes(query) || displayName.toLowerCase().includes(query)
    })
  }, [colorSearch, t])

  const handleSave = useCallback(() => {
    // Always patch icon/color/description from the form; omit position so graph
    // coordinates are preserved by setDataclassCustomization merge.
    setDataclassCustomization(dataclassName, {
      icon: selectedIcon ?? '',
      color: selectedColor ?? '',
      description: description.trim(),
    })
    onOpenChange(false)
  }, [
    dataclassName,
    selectedIcon,
    selectedColor,
    description,
    setDataclassCustomization,
    onOpenChange,
  ])

  const handleReset = useCallback(() => {
    removeDataclassCustomization(dataclassName)
    setSelectedIcon(undefined)
    setSelectedColor(undefined)
    setDescription('')
  }, [dataclassName, removeDataclassCustomization])

  // Random selection - picks both icon and color at once
  const handleRandom = useCallback(() => {
    const randomIconIndex = Math.floor(Math.random() * ICON_PRESETS.length)
    setSelectedIcon(ICON_PRESETS[randomIconIndex])
    const colorKeys = Object.keys(COLOR_PRESETS).filter((key) => key !== 'default')
    const randomColorIndex = Math.floor(Math.random() * colorKeys.length)
    setSelectedColor(colorKeys[randomColorIndex])
    setIconScrollNonce((n) => n + 1)
    setTimeout(() => {
      selectedColorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
  }, [])

  // Render icon by name
  const renderIcon = (iconName: string, className?: string) => {
    const Icon = resolveLucideIcon(iconName)
    if (!Icon) return null
    return <Icon className={className} />
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogTitle className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              selectedColor && selectedColor !== 'default'
                ? COLOR_PRESETS[selectedColor as ColorPreset]?.bg
                : 'bg-primary'
            )}
          >
            {renderIcon(selectedIcon || 'Database', 'h-5 w-5 text-white')}
          </div>
          <div className="flex-1">
            <span>
              Customize <span className="font-semibold text-primary">{dataclassName}</span>
            </span>
            <p className="font-normal text-muted-foreground text-sm">
              Set icon, color, and description
            </p>
          </div>
        </DialogTitle>

        <div className="space-y-4 py-4">
          {/* Description - First */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">{t('settings.description')}</Label>
            <Input
              placeholder={t('settings.customDescriptionOptional')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
            <p className="text-muted-foreground text-xs">{t('settings.descriptionHelp')}</p>
          </div>

          {/* Icon and Color side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Icon Selection */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">{t('settings.icon')}</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('settings.searchIcons')}
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
              {filteredIcons.length === 0 ? (
                <div className="flex h-50 items-center justify-center rounded-lg border p-2">
                  <EmptyPanel
                    icon={Smile}
                    badgeIcon={Search}
                    badgeTone="amber"
                    title={t('settings.noIconsFound')}
                    ghost="none"
                    size="sm"
                  />
                </div>
              ) : (
                <VirtualIconGrid
                  icons={filteredIcons}
                  value={selectedIcon}
                  onSelect={setSelectedIcon}
                  height={200}
                  scrollNonce={iconScrollNonce}
                />
              )}
              <p className="text-muted-foreground text-xs">
                {t('settings.iconCatalogCount', { count: filteredIcons.length })}
              </p>
            </div>

            {/* Color Selection */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">{t('settings.color')}</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('settings.searchColors')}
                  value={colorSearch}
                  onChange={(e) => setColorSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
              <div className="scrollbar-none h-50 overflow-y-auto rounded-lg border p-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid grid-cols-2 gap-2">
                  {filteredColors.map(([key, preset]) => {
                    const isSelected =
                      selectedColor === key || (!selectedColor && key === 'default')
                    return (
                      <Button
                        type="button"
                        key={key}
                        ref={isSelected ? selectedColorRef : undefined}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedColor(key === 'default' ? undefined : key)}
                        className={cn(
                          'h-9 justify-start gap-2 rounded-lg border px-3 transition-colors',
                          isSelected ? 'border-primary bg-primary/10' : 'border-border'
                        )}
                        title={t(preset.nameKey)}
                      >
                        <div
                          className={cn(
                            'h-4 w-4 shrink-0 rounded-full',
                            key === 'default' ? 'bg-primary' : preset.bg
                          )}
                        />
                        <span className="truncate text-xs">{t(preset.nameKey)}</span>
                      </Button>
                    )
                  })}
                  {filteredColors.length === 0 && (
                    <EmptyPanel
                      icon={Palette}
                      badgeIcon={Search}
                      badgeTone="amber"
                      title={t('settings.noColorsFound')}
                      ghost="none"
                      size="sm"
                      className="col-span-2"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Random Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={handleRandom}
              className="gap-2"
              title={t('settings.randomize')}
            >
              <Dices className="h-4 w-4" />
              {t('settings.randomIconAndColor')}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t('settings.restoreDefaults')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper component to render a dataclass icon based on customization
export function DataclassIcon({
  customization,
  className,
  fallback = 'Database',
}: {
  customization?: DataclassCustomization
  className?: string
  fallback?: string
}) {
  const iconName = customization?.icon || fallback
  const Icon = resolveLucideIcon(iconName)
  if (Icon) {
    return <Icon className={className} />
  }

  // Emoji / free-text icons (e.g. assistant-set "🚀") — not Lucide names.
  if (
    customization?.icon &&
    customization.icon !== fallback &&
    !looksLikeLucideIconName(customization.icon)
  ) {
    return (
      <span
        role="img"
        aria-label={customization.icon}
        className={cn('inline-flex items-center justify-center leading-none', className)}
        style={{ fontSize: '1.15em' }}
      >
        {customization.icon}
      </span>
    )
  }

  const FallbackIcon = resolveLucideIcon(fallback)
  return FallbackIcon ? <FallbackIcon className={className} /> : null
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim())
}

export type DataclassColorClasses = {
  text: string
  bg: string
  ring: string
  borderLeft: string
  bgTint: string
  bgTintStrong: string
  headerText: string
  headerTextMuted: string
  /** CSS variable `--dc-color` for hex customizations; set on a parent element. */
  style?: CSSProperties
}

// Get color classes for a customization
export function getDataclassColorClasses(
  customization?: DataclassCustomization
): DataclassColorClasses {
  const base: DataclassColorClasses = {
    text: 'text-primary',
    bg: 'bg-primary',
    ring: 'ring-primary',
    borderLeft: 'border-l-primary',
    bgTint: 'bg-primary/10',
    bgTintStrong: 'bg-primary/20',
    headerText: 'text-primary-foreground',
    headerTextMuted: 'text-primary-foreground',
  }
  if (!customization?.color || customization.color === 'default') {
    return base
  }

  const color = customization.color.trim()
  if (isHexColor(color)) {
    return {
      text: 'text-[var(--dc-color)]',
      bg: 'bg-[var(--dc-color)]',
      ring: 'ring-[var(--dc-color)]',
      borderLeft: 'border-l-[var(--dc-color)]',
      bgTint: 'bg-[color-mix(in_srgb,var(--dc-color)_10%,transparent)]',
      bgTintStrong: 'bg-[color-mix(in_srgb,var(--dc-color)_20%,transparent)]',
      headerText: 'text-white',
      headerTextMuted: 'text-white',
      style: { '--dc-color': color } as CSSProperties,
    }
  }

  const preset = COLOR_PRESETS[color as ColorPreset]
  return preset
    ? {
        text: preset.class,
        bg: preset.bg,
        ring: preset.ring,
        borderLeft: preset.bg.replace('bg-', 'border-l-') as string,
        bgTint: preset.bgTint,
        bgTintStrong: preset.bgTintStrong,
        headerText: 'text-white',
        headerTextMuted: 'text-white',
      }
    : base
}
