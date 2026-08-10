import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@4d/ui'
import {
  FileDown,
  FileText,
  Info,
  MoreHorizontal,
  PanelBottom,
  Play,
  Send,
  Settings,
  Terminal,
} from 'lucide-react'
import { AiTasksFooterControl } from '~/components/AiActions/AiTasksFooterControl'
import { AppearanceControls } from '~/components/AppearanceControls'
import { MobileDockButton } from '~/components/MobileDockButton'
import { OnlineStatusFooterControl } from '~/components/OnlineStatusFooterControl'
import { useAssistantLlmConfigured } from '~/hooks/useAssistantLlmConfigured'
import { useTranslation } from '~/i18n'
import { emitOpenAboutDialog } from '~/lib/about-dialog'
import {
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuHeaderClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { useConsoleStore } from '~/store/console'
import { useSettingsStore } from '~/store/settings'
import { RELEASE_NOTES_STATIC_ID, useTabsStore } from '~/store/tabs'

/** Connected-shell footer dock for the mobile app. */
export function MobileAppFooter() {
  const { t } = useTranslation()
  const aiConfigured = useAssistantLlmConfigured()
  const consoleOpen = useSettingsStore((s) => s.consoleOpen)
  const bottomPanelTab = useSettingsStore((s) => s.bottomPanelTab)
  const toggleConsoleOpen = useSettingsStore((s) => s.toggleConsoleOpen)
  const toggleTerminalOpen = useSettingsStore((s) => s.toggleTerminalOpen)
  const consoleErrorCount = useConsoleStore(
    (state) => state.entries.filter((entry) => entry.level === 'error').length
  )
  const consoleWarnCount = useConsoleStore(
    (state) => state.entries.filter((entry) => entry.level === 'warn').length
  )
  const openMethodExecutorTab = useTabsStore((state) => state.openMethodExecutorTab)
  const openHttpClientTab = useTabsStore((state) => state.openHttpClientTab)
  const openRestExportBuilderTab = useTabsStore((state) => state.openRestExportBuilderTab)
  const openSettingsTab = useTabsStore((state) => state.openSettingsTab)
  const openStaticTab = useTabsStore((state) => state.openStaticTab)

  const consoleBadge = consoleErrorCount + consoleWarnCount > 0

  return (
    <footer
      className={cn(
        'relative z-20 shrink-0 border-border/60 border-t bg-background/95 backdrop-blur-sm',
        'pt-1 pb-[max(0.375rem,var(--app-safe-bottom))]'
      )}
    >
      <div className="flex justify-center px-1.5 pb-1 empty:hidden">
        <OnlineStatusFooterControl />
      </div>
      <nav
        className={cn(
          'mx-auto grid max-w-lg gap-0.5 px-1.5',
          aiConfigured ? 'grid-cols-5' : 'grid-cols-4'
        )}
        aria-label={t('layout.footerNavAria')}
      >
        <MobileDockButton
          label={t('console.title')}
          pressed={consoleOpen && bottomPanelTab === 'console'}
          onClick={toggleConsoleOpen}
          aria-label={
            consoleOpen && bottomPanelTab === 'console' ? t('console.close') : t('console.open')
          }
          className="relative"
        >
          <PanelBottom className="h-5 w-5" />
          {consoleBadge ? (
            <span
              className="absolute top-1.5 right-[28%] h-2 w-2 rounded-full bg-destructive"
              aria-hidden
            />
          ) : null}
        </MobileDockButton>

        <MobileDockButton
          label={t('terminal.title')}
          pressed={consoleOpen && bottomPanelTab === 'terminal'}
          onClick={toggleTerminalOpen}
          aria-label={
            consoleOpen && bottomPanelTab === 'terminal' ? t('terminal.close') : t('terminal.open')
          }
        >
          <Terminal className="h-5 w-5" />
        </MobileDockButton>

        {aiConfigured ? <AiTasksFooterControl dock /> : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <MobileDockButton label={t('layout.tools')} aria-label={t('layout.toolsAria')}>
              <MoreHorizontal className="h-5 w-5" />
            </MobileDockButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            side="top"
            className={mobileMenuContentClass()}
            {...mobileMenuCollisionProps}
          >
            <DropdownMenuLabel className={mobileMenuHeaderClass('text-sm')}>
              {t('layout.tools')}
            </DropdownMenuLabel>
            <DropdownMenuItem
              className={mobileMenuItemClass()}
              onClick={() => openMethodExecutorTab()}
            >
              <Play className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t('tabs.methodExecutor')}
            </DropdownMenuItem>
            <DropdownMenuItem className={mobileMenuItemClass()} onClick={() => openHttpClientTab()}>
              <Send className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t('tabs.httpClient')}
            </DropdownMenuItem>
            <DropdownMenuItem className={mobileMenuItemClass()} onClick={openRestExportBuilderTab}>
              <FileDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t('tabs.restExport')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={mobileMenuItemClass()} onClick={() => openSettingsTab()}>
              <Settings className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t('layout.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={mobileMenuItemClass()}
              onClick={() => openStaticTab(RELEASE_NOTES_STATIC_ID)}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">{t('layout.releaseNotes')}</span>
              <span className="shrink-0 font-mono text-muted-foreground text-xs">
                v{__APP_VERSION__}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={mobileMenuItemClass()}
              onClick={() => emitOpenAboutDialog()}
            >
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t('desktopMenu.about', { appName: t('app.title') })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AppearanceControls variant="menu" side="top" align="center" />
      </nav>
    </footer>
  )
}
