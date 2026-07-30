import { Button, cn } from '@4d/ui'
import { PanelBottom, Terminal as TerminalIcon, X } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { ConsolePanel } from '~/components/Console/ConsolePanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { useSettingsStore } from '~/store/settings'

const TerminalPanel = lazy(() =>
  import('~/components/Terminal/TerminalPanel').then((m) => ({ default: m.TerminalPanel }))
)

export type BottomPanelTab = 'console' | 'terminal'

/**
 * Shared chrome for the footer dock: tab strip + active panel body.
 */
export function BottomDockPanel() {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const tab = useSettingsStore((s) => s.bottomPanelTab)
  const setBottomPanelTab = useSettingsStore((s) => s.setBottomPanelTab)
  const setConsoleOpen = useSettingsStore((s) => s.setConsoleOpen)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 border-border/70 border-b bg-linear-to-b from-muted/35 to-muted/10 px-1.5',
          mobile ? 'min-h-11 pt-1.5' : 'pt-1'
        )}
      >
        <Button
          size={mobile ? 'sm' : 'xs'}
          variant={tab === 'console' ? 'secondary' : 'ghost'}
          className={cn(
            'touch-manipulation gap-1.5 rounded-b-none transition-colors',
            mobile ? 'h-9 px-3 text-sm' : 'h-6 px-2 text-[11px]',
            tab === 'console' && 'border-b-2 border-b-primary shadow-sm'
          )}
          onClick={() => setBottomPanelTab('console')}
          aria-pressed={tab === 'console'}
        >
          <PanelBottom className={mobile ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
          {t('console.title')}
        </Button>
        <Button
          size={mobile ? 'sm' : 'xs'}
          variant={tab === 'terminal' ? 'secondary' : 'ghost'}
          className={cn(
            'touch-manipulation gap-1.5 rounded-b-none transition-colors',
            mobile ? 'h-9 px-3 text-sm' : 'h-6 px-2 text-[11px]',
            tab === 'terminal' && 'border-b-2 border-b-primary shadow-sm'
          )}
          onClick={() => setBottomPanelTab('terminal')}
          aria-pressed={tab === 'terminal'}
        >
          <TerminalIcon className={mobile ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
          {t('terminal.title')}
        </Button>
        <div className="ml-auto pb-0.5">
          <Button
            size={mobile ? 'sm' : 'xs'}
            variant="ghost"
            className={cn('touch-manipulation', mobile ? 'h-9 w-9 p-0' : 'h-6 w-6 p-0')}
            onClick={() => setConsoleOpen(false)}
            aria-label={tab === 'terminal' ? t('terminal.close') : t('console.close')}
          >
            <X className={mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'terminal' ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                {t('terminal.loading')}
              </div>
            }
          >
            <TerminalPanel hideChrome />
          </Suspense>
        ) : (
          <ConsolePanel hideChrome />
        )}
      </div>
    </div>
  )
}
