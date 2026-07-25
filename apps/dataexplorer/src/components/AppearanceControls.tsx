import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Languages, Loader2, Moon, Palette, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Locale } from '~/i18n'
import { useTranslation } from '~/i18n'
import { useTheme, useThemeName } from '~/providers/ThemeProvider'
import { formatShortcut, useSettingsStore, useShortcuts } from '~/store/settings'

const THEME_SWATCHES: Record<string, string> = {
  slate: '#334155',
  tangerine: '#ea580c',
  'violet-bloom': '#7c3aed',
  graphite: '#3f3f46',
  aurora: '#06b6d4',
}

const DEFAULT_SWATCH = '#171717'

export type AppearanceControlsProps = {
  /** Side on which dropdowns and tooltips open. Defaults to `top` (footer usage). */
  side?: 'top' | 'bottom'
  /** Alignment of dropdown content. Defaults to `end`. */
  align?: 'start' | 'center' | 'end'
  /** Extra classes for the wrapping container. */
  className?: string
  /** Whether to render the full-page language switch overlay. Defaults to `true`. */
  showLanguageOverlay?: boolean
}

/**
 * Reusable language / color-theme / light-dark-mode controls.
 *
 * Encapsulates the footer-style appearance items so they can be shared across
 * the main app footer and standalone screens (e.g. the desktop connection
 * screen) without re-implementing the UX. Requires a surrounding `ThemeProvider`
 * and `I18nProvider`.
 */
export function AppearanceControls({
  side = 'top',
  align = 'end',
  className,
  showLanguageOverlay = true,
}: AppearanceControlsProps) {
  const { t } = useTranslation()
  const { themeName, setThemeName, availableThemes } = useThemeName()
  const { toggleTheme, theme } = useTheme()
  const language = useSettingsStore((state) => state.language) as Locale
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const shortcuts = useShortcuts()
  const themeShortcut = shortcuts.find((s) => s.id === 'toggle-theme')

  const [pendingLanguageSwitch, setPendingLanguageSwitch] = useState<Locale | null>(null)

  // When user selects a new language: show overlay for 2s then apply switch
  useEffect(() => {
    if (pendingLanguageSwitch === null) return
    const timer = setTimeout(() => {
      setLanguage(pendingLanguageSwitch)
      setPendingLanguageSwitch(null)
    }, 2000)
    return () => clearTimeout(timer)
  }, [pendingLanguageSwitch, setLanguage])

  const languageOptions: { id: Locale; flag: string; label: string }[] = [
    { id: 'en', flag: '🇺🇸', label: t('language.english') },
    { id: 'fr', flag: '🇫🇷', label: t('language.french') },
    { id: 'es', flag: '🇪🇸', label: t('language.spanish') },
  ]

  return (
    <>
      {showLanguageOverlay && pendingLanguageSwitch !== null && (
        <output
          className="fade-in fixed inset-0 z-100 flex animate-in flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm duration-300"
          aria-live="polite"
          aria-label={t('layout.switchingTitle')}
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="font-medium text-foreground text-lg">{t('layout.switchingTitle')}</p>
            <p className="text-muted-foreground text-sm">{t('layout.switchingPreparing')}</p>
          </div>
        </output>
      )}

      <div className={cn('flex items-center gap-0.5', className)}>
        {/* Language */}
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={t('layout.language')}
                  >
                    <Languages className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side={side}>{t('layout.language')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align={align} side={side} className="w-44">
            <div className="px-2 py-1.5">
              <p className="font-medium text-sm">{t('layout.language')}</p>
            </div>
            <DropdownMenuSeparator />
            {languageOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.id}
                onClick={() => {
                  if (language !== opt.id) setPendingLanguageSwitch(opt.id)
                }}
                className={cn(
                  'flex items-center gap-2',
                  language === opt.id && 'bg-primary text-primary-foreground'
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {opt.flag}
                </span>
                <span>{opt.label}</span>
                {language === opt.id && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Color theme */}
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={t('layout.themeAria')}
                  >
                    <Palette className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side={side}>
                {t('layout.themeAria')}
                {themeShortcut?.enabled ? (
                  <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                    {formatShortcut(themeShortcut)}
                  </kbd>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align={align} side={side} className="w-48">
            <div className="px-2 py-1.5">
              <p className="font-medium text-sm">{t('layout.colorTheme')}</p>
              <p className="text-muted-foreground text-xs">{t('layout.chooseColors')}</p>
            </div>
            <DropdownMenuSeparator />
            {Object.entries(availableThemes).map(([key, themeOption]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setThemeName(key as typeof themeName)}
                className={cn(
                  'flex items-center gap-2',
                  themeName === key && 'bg-primary text-primary-foreground'
                )}
              >
                <div
                  className="h-4 w-4 rounded-full border"
                  style={{ background: THEME_SWATCHES[key] ?? DEFAULT_SWATCH }}
                />
                <span>{themeOption.name}</span>
                {themeName === key && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Light / dark mode */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('layout.lightMode') : t('layout.darkMode')}
              >
                <Sun className="h-3 w-3 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-3 w-3 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={side}>
              {theme === 'dark' ? t('layout.lightMode') : t('layout.darkMode')}
              {themeShortcut?.enabled ? (
                <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                  {formatShortcut(themeShortcut)}
                </kbd>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  )
}
