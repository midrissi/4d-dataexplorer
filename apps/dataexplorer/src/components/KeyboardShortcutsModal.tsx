import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@4d/ui'
import {
  Command,
  Eye,
  Keyboard,
  Layers,
  Loader2,
  type LucideIcon,
  Navigation,
  PanelLeft,
  Settings,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  formatKeyCombo,
  formatShortcut,
  type KeyboardShortcut,
  type ShortcutCategory,
  useShortcuts,
} from '~/store/settings'
import { useTabsStore } from '~/store/tabs'

export const CATEGORY_CONFIG: Record<
  ShortcutCategory,
  { icon: LucideIcon; description: string; iconColor: string; bgColor: string }
> = {
  General: {
    icon: Command,
    description: 'Core commands',
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
  },
  View: {
    icon: Eye,
    description: 'Display options',
    iconColor: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
  },
  Navigation: {
    icon: Navigation,
    description: 'Move around',
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
  },
  Entities: {
    icon: Layers,
    description: 'Manage data',
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
  },
  Tabs: {
    icon: PanelLeft,
    description: 'Tab management',
    iconColor: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
  },
}

export const CATEGORY_ORDER: ShortcutCategory[] = [
  'General',
  'View',
  'Navigation',
  'Entities',
  'Tabs',
]

// Render keyboard key with subtle 3D effect
function KeyCap({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <kbd
      className={`inline-flex min-w-6.5 items-center justify-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-medium font-mono text-[11px] shadow-[0_1px_0_0_hsl(var(--border))] ${disabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}
      `}
    >
      {children}
    </kbd>
  )
}

// Parse and render a shortcut string as key caps (e.g. "Ctrl+K" → KeyCap "Ctrl" + KeyCap "K")
function ShortcutKeys({ shortcut, disabled }: { shortcut: string; disabled?: boolean }) {
  const parts = shortcut.split(/\s+/).filter(Boolean)
  return (
    <div className="flex items-center gap-1">
      <KeyCap disabled={disabled}>{parts.join(' ')}</KeyCap>
    </div>
  )
}

// Render a single shortcut: chorded as "Step 1 then Step 2", otherwise as key caps
function ShortcutDisplay({
  shortcut,
  disabled,
}: {
  shortcut: KeyboardShortcut
  disabled?: boolean
}) {
  const chord = shortcut.chord
  if (chord && chord.length === 2) {
    const [first, second] = chord
    const firstStr = formatKeyCombo(first)
    const secondStr = formatKeyCombo(second)
    return (
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1">
          <ShortcutKeys shortcut={firstStr} disabled={disabled} />
        </div>
        <div className="flex items-center gap-1">
          <ShortcutKeys shortcut={secondStr} disabled={disabled} />
        </div>
      </div>
    )
  }
  return <ShortcutKeys shortcut={formatShortcut(shortcut)} disabled={disabled} />
}

interface KeyboardShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation()
  const shortcuts = useShortcuts()
  const openSettingsTab = useTabsStore((state) => state.openSettingsTab)
  const [openingSettings, setOpeningSettings] = useState(false)

  // Group enabled shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const enabledShortcuts = shortcuts.filter((s) => s.enabled)
    const grouped = new Map<ShortcutCategory, typeof enabledShortcuts>()

    for (const category of CATEGORY_ORDER) {
      const categoryShortcuts = enabledShortcuts.filter((s) => s.category === category)
      if (categoryShortcuts.length > 0) {
        grouped.set(category, categoryShortcuts)
      }
    }

    return grouped
  }, [shortcuts])

  const enabledCount = shortcuts.filter((s) => s.enabled).length
  const totalCount = shortcuts.length
  const showShortcutsShortcut = useMemo(
    () => shortcuts.find((s) => s.id === 'show-shortcuts'),
    [shortcuts]
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setOpeningSettings(false)
    onOpenChange(nextOpen)
  }

  const handleOpenSettings = async () => {
    if (openingSettings) return
    setOpeningSettings(true)
    try {
      // Prefetch the lazy SettingsPage chunk before switching tabs so the UI
      // can show button loading instead of freezing on a cold import.
      await import('~/components/SettingsPage')
      openSettingsTab({ section: 'shortcuts' })
      onOpenChange(false)
    } catch {
      setOpeningSettings(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Keyboard className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>{t('settings.keyboardShortcuts')}</DialogTitle>
              <DialogDescription>{t('settings.keyboardShortcutsDescription')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {groupedShortcuts.size > 0 ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {Array.from(groupedShortcuts.entries()).map(([category, categoryShortcuts]) => {
              const config = CATEGORY_CONFIG[category]
              const Icon = config.icon

              return (
                <div key={category} className="rounded-lg border bg-card/30">
                  {/* Category Header */}
                  <div className="flex items-center gap-2.5 border-border/50 border-b px-4 py-2.5">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-md ${config.bgColor}`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{t(`category.${category}`)}</h3>
                      <p className="text-muted-foreground text-xs">
                        {t(`categoryDesc.${category}`)}
                      </p>
                    </div>
                  </div>

                  {/* Shortcuts List */}
                  <div
                    className={`p-2 ${category === 'View' || category === 'Entities' || category === 'Navigation' || category === 'Tabs' ? 'grid grid-cols-2 gap-x-2' : ''}`}
                  >
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1 text-muted-foreground text-sm">
                          {t(`shortcut.${shortcut.id}`) || shortcut.label}
                          {shortcut.chord && shortcut.chord.length === 2 && (
                            <span className="ml-1.5 text-muted-foreground/70 text-xs">
                              {t('settings.twoStep')}
                            </span>
                          )}
                        </span>
                        <ShortcutDisplay shortcut={shortcut} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Keyboard className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">{t('settings.allShortcutsDisabled')}</p>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              disabled={openingSettings}
              onClick={() => void handleOpenSettings()}
            >
              {openingSettings ? t('settings.openingSettings') : t('settings.enableInSettings')}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={openingSettings}
            onClick={() => void handleOpenSettings()}
          >
            {openingSettings ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Settings className="h-3.5 w-3.5" aria-hidden />
            )}
            {openingSettings ? t('settings.openingSettings') : t('settings.customize')}
          </Button>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground text-xs">
            <span>
              {t('settings.shortcutsEnabledOfTotal', { enabled: enabledCount, total: totalCount })}
            </span>
            <div className="flex items-center gap-1.5">
              {(() => {
                const [before, after] = t('settings.pressAnytimeToShowThis').split('?')
                return (
                  <>
                    <span>{before}</span>
                    {showShortcutsShortcut ? (
                      <ShortcutDisplay
                        shortcut={showShortcutsShortcut}
                        disabled={!showShortcutsShortcut.enabled}
                      />
                    ) : (
                      <KeyCap>?</KeyCap>
                    )}
                    <span>{after}</span>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
