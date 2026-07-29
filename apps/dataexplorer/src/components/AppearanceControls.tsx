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
import { type ReactNode, useEffect, useState } from 'react'
import { MobileDockButton } from '~/components/MobileDockButton'
import type { Locale } from '~/i18n'
import { useTranslation } from '~/i18n'
import {
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuHeaderClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'
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
  /**
   * `icons` — compact icon cluster (desktop footer).
   * `toolbar` — full-width labeled bar for mobile connection screens.
   * `menu` — single dock button that opens a sheet with language / theme / mode.
   */
  variant?: 'icons' | 'toolbar' | 'menu'
  /** Control size for `icons` variant. `md` ≈ 44px. Defaults to `sm`. */
  size?: 'sm' | 'md'
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
  variant = 'icons',
  size = 'sm',
}: AppearanceControlsProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { themeName, setThemeName, availableThemes } = useThemeName()
  const { toggleTheme, theme } = useTheme()
  const language = useSettingsStore((state) => state.language) as Locale
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const shortcuts = useShortcuts()
  const themeShortcut = shortcuts.find((s) => s.id === 'toggle-theme')

  const isToolbar = variant === 'toolbar'
  const isMenu = variant === 'menu'
  const useSheet = mobile || isToolbar || isMenu
  const menuAlign = isToolbar || isMenu || mobile ? 'center' : align
  const menuSide = mobile || isMenu ? 'top' : side
  const iconClass = isToolbar || isMenu || size === 'md' || mobile ? 'h-5 w-5' : 'h-3 w-3'
  const itemClass = useSheet ? mobileMenuItemClass() : undefined
  const menuClass = useSheet
    ? mobile
      ? mobileMenuContentClass()
      : isMenu
        ? mobileMenuContentClass()
        : 'w-[min(calc(100vw-2rem),18rem)] p-1.5'
    : undefined

  const [pendingLanguageSwitch, setPendingLanguageSwitch] = useState<Locale | null>(null)

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

  const modeLabel = theme === 'dark' ? t('mobile.appearanceLight') : t('mobile.appearanceDark')

  const wrapTrigger = (trigger: ReactNode, tooltip: ReactNode) => {
    if (isToolbar || isMenu) return trigger
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side={side}>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const renderToolbarLabel = (label: string) => (
    <span className="max-w-full truncate font-medium text-[11px] text-muted-foreground leading-none">
      {label}
    </span>
  )

  const languageTrigger = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size={isToolbar ? 'default' : 'icon'}
        className={cn(
          isToolbar
            ? 'h-auto min-h-14 w-full flex-col gap-1.5 rounded-xl px-2 py-2.5 text-muted-foreground hover:text-foreground'
            : size === 'md'
              ? 'h-11 w-11'
              : 'h-6 w-6'
        )}
        aria-label={t('layout.language')}
      >
        <Languages className={iconClass} aria-hidden />
        {isToolbar ? renderToolbarLabel(t('mobile.appearanceLanguage')) : null}
      </Button>
    </DropdownMenuTrigger>
  )

  const themeTrigger = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size={isToolbar ? 'default' : 'icon'}
        className={cn(
          isToolbar
            ? 'h-auto min-h-14 w-full flex-col gap-1.5 rounded-xl px-2 py-2.5 text-muted-foreground hover:text-foreground'
            : size === 'md'
              ? 'h-11 w-11'
              : 'h-6 w-6'
        )}
        aria-label={t('layout.themeAria')}
      >
        <Palette className={iconClass} aria-hidden />
        {isToolbar ? renderToolbarLabel(t('mobile.appearanceTheme')) : null}
      </Button>
    </DropdownMenuTrigger>
  )

  const modeButton = (
    <Button
      variant="ghost"
      size={isToolbar ? 'default' : 'icon'}
      className={cn(
        'relative',
        isToolbar
          ? 'h-auto min-h-14 w-full flex-col gap-1.5 rounded-xl px-2 py-2.5 text-muted-foreground hover:text-foreground'
          : size === 'md'
            ? 'h-11 w-11'
            : 'h-6 w-6'
      )}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? t('layout.lightMode') : t('layout.darkMode')}
    >
      <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
        <Sun
          className={cn(
            iconClass,
            'rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0'
          )}
        />
        <Moon
          className={cn(
            iconClass,
            'absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100'
          )}
        />
      </span>
      {isToolbar ? renderToolbarLabel(modeLabel) : null}
    </Button>
  )

  if (isMenu) {
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

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <MobileDockButton
              label={t('mobile.appearanceToolbar')}
              className={className}
              aria-label={t('mobile.appearanceToolbar')}
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                <Sun
                  className={cn(
                    iconClass,
                    'rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0'
                  )}
                />
                <Moon
                  className={cn(
                    iconClass,
                    'absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100'
                  )}
                />
              </span>
            </MobileDockButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={menuAlign}
            side={menuSide}
            className={cn(menuClass, 'max-h-[min(70dvh,28rem)]')}
            {...(mobile
              ? mobileMenuCollisionProps
              : { collisionPadding: 12, avoidCollisions: true })}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className={mobileMenuHeaderClass()}>
              <p className="font-medium text-sm">{t('layout.language')}</p>
            </div>
            {languageOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.id}
                onClick={() => {
                  if (language !== opt.id) setPendingLanguageSwitch(opt.id)
                }}
                className={cn(
                  'flex items-center gap-2',
                  itemClass,
                  language === opt.id && 'bg-primary text-primary-foreground'
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {opt.flag}
                </span>
                <span className="min-w-0 flex-1">{opt.label}</span>
                {language === opt.id ? <span className="ml-auto text-xs">✓</span> : null}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <div className={mobileMenuHeaderClass()}>
              <p className="font-medium text-sm">{t('layout.colorTheme')}</p>
              <p className="text-muted-foreground text-xs">{t('layout.chooseColors')}</p>
            </div>
            {Object.entries(availableThemes).map(([key, themeOption]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setThemeName(key as typeof themeName)}
                className={cn(
                  'flex items-center gap-2',
                  itemClass,
                  themeName === key && 'bg-primary text-primary-foreground'
                )}
              >
                <div
                  className="h-5 w-5 shrink-0 rounded-full border"
                  style={{ background: THEME_SWATCHES[key] ?? DEFAULT_SWATCH }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">{themeOption.name}</span>
                {themeName === key ? <span className="ml-auto text-xs">✓</span> : null}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem className={mobileMenuItemClass()} onClick={toggleTheme}>
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Moon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              {modeLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )
  }

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

      <div
        className={cn(
          isToolbar
            ? 'grid w-full grid-cols-3 gap-1'
            : cn('flex items-center', size === 'md' ? 'gap-1' : 'gap-0.5'),
          className
        )}
        {...(isToolbar
          ? { role: 'group' as const, 'aria-label': t('mobile.appearanceToolbar') }
          : {})}
      >
        <DropdownMenu modal={false}>
          {wrapTrigger(languageTrigger, t('layout.language'))}
          <DropdownMenuContent
            align={menuAlign}
            side={menuSide}
            className={cn(useSheet ? menuClass : 'w-44')}
            {...(mobile
              ? mobileMenuCollisionProps
              : { collisionPadding: 12, avoidCollisions: true })}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className={useSheet ? mobileMenuHeaderClass() : 'px-2 py-1.5'}>
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
                  itemClass,
                  language === opt.id && 'bg-primary text-primary-foreground'
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {opt.flag}
                </span>
                <span className="min-w-0 flex-1">{opt.label}</span>
                {language === opt.id && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu modal={false}>
          {wrapTrigger(
            themeTrigger,
            <>
              {t('layout.themeAria')}
              {themeShortcut?.enabled ? (
                <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                  {formatShortcut(themeShortcut)}
                </kbd>
              ) : null}
            </>
          )}
          <DropdownMenuContent
            align={menuAlign}
            side={menuSide}
            className={cn(useSheet ? menuClass : 'w-48')}
            {...(mobile
              ? mobileMenuCollisionProps
              : { collisionPadding: 12, avoidCollisions: true })}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className={useSheet ? mobileMenuHeaderClass() : 'px-2 py-1.5'}>
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
                  itemClass,
                  themeName === key && 'bg-primary text-primary-foreground'
                )}
              >
                <div
                  className={cn('shrink-0 rounded-full border', useSheet ? 'h-5 w-5' : 'h-4 w-4')}
                  style={{ background: THEME_SWATCHES[key] ?? DEFAULT_SWATCH }}
                />
                <span className="min-w-0 flex-1">{themeOption.name}</span>
                {themeName === key && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {wrapTrigger(
          modeButton,
          <>
            {theme === 'dark' ? t('layout.lightMode') : t('layout.darkMode')}
            {themeShortcut?.enabled ? (
              <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                {formatShortcut(themeShortcut)}
              </kbd>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
