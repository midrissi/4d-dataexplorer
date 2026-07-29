import { Alert, AlertDescription, Button, cn } from '@4d/ui'
import { ArrowRight, Database, Info, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { AppBrandIcon } from '~/components/AppBrandIcon'
import { AppearanceControls } from '~/components/AppearanceControls'
import { useTranslation } from '~/i18n'
import { resolveLucideIcon } from '~/lib/lucide-icon'
import { COLOR_PRESETS, type ColorPreset } from '~/store/settings'
import type { ConnectionConfig } from '~desktop/lib/connection-store'

type MobileConnectionHomeProps = {
  connections: ConnectionConfig[]
  loading: boolean
  submitting: boolean
  onNew: () => void
  onConnect: (connection: ConnectionConfig) => void
  onEdit: (connection: ConnectionConfig) => void
  onDelete: (id: string) => void
}

export function MobileConnectionHome({
  connections,
  loading,
  submitting,
  onNew,
  onConnect,
  onEdit,
  onDelete,
}: MobileConnectionHomeProps) {
  const { t } = useTranslation()
  const empty = !loading && connections.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="relative z-20 shrink-0 px-5 pt-[max(1.25rem,var(--app-safe-top))] pb-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 shadow-xs" aria-hidden>
            <AppBrandIcon className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-semibold text-lg tracking-tight">{t('app.title')}</h1>
              <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 font-medium text-[10px] text-warning uppercase tracking-wide">
                {t('mobile.betaBadge')}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{t('mobile.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-3">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground text-sm">{t('mobile.loading')}</p>
          </div>
        ) : empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-2 py-8 text-center">
            <div className="mb-5 h-16 w-16" aria-hidden>
              <AppBrandIcon className="h-full w-full" />
            </div>
            <h2 className="max-w-[18rem] font-semibold text-foreground text-xl tracking-tight">
              {t('connectionScreen.emptyTitle')}
            </h2>
            <p className="mt-2 max-w-[20rem] text-muted-foreground text-sm leading-relaxed">
              {t('connectionScreen.emptyDescription')}
            </p>
            <Button
              type="button"
              className="mt-6 h-12 w-full max-w-sm gap-2 text-base"
              onClick={onNew}
            >
              <Plus className="h-5 w-5" aria-hidden />
              {t('connectionScreen.newConnection')}
            </Button>
            <Alert className="mt-6 w-full max-w-sm border-border/80 bg-muted/40 text-left">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
                {t('mobile.lanHint')}
              </AlertDescription>
            </Alert>
            <p className="mt-4 max-w-[20rem] text-[11px] text-muted-foreground leading-relaxed">
              {t('mobile.betaDisclaimer')}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 pt-1">
            <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {t('connectionScreen.sidebarTitle')}
            </h2>
            <ul className="space-y-2.5">
              {connections.map((connection, index) => {
                const colorPreset =
                  connection.color && connection.color in COLOR_PRESETS
                    ? COLOR_PRESETS[connection.color as ColorPreset]
                    : COLOR_PRESETS.default
                const Icon = resolveLucideIcon(connection.icon ?? 'Database') ?? Database
                return (
                  <li key={connection.id}>
                    <div
                      className={cn(
                        'flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-colors',
                        index === 0 && 'border-primary/40 ring-1 ring-primary/20'
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={submitting}
                        onClick={() => onConnect(connection)}
                      >
                        <div
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white',
                            colorPreset.bg
                          )}
                          aria-hidden
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">{connection.name}</p>
                          <p className="truncate text-muted-foreground text-xs">
                            {connection.baseUrl}
                          </p>
                        </div>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                      <div className="flex shrink-0 items-center border-border border-l">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-14 w-11 rounded-none text-muted-foreground"
                          onClick={() => onEdit(connection)}
                          aria-label={t('layout.editConnection')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-14 w-11 rounded-none text-destructive"
                          onClick={() => onDelete(connection.id)}
                          aria-label={t('mobile.deleteConnection')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <Alert className="mt-2 border-border/80 bg-muted/30">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
                {t('mobile.lanHint')}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      <footer className="relative z-20 shrink-0 space-y-3 border-border border-t bg-background px-4 pt-3 pb-[var(--app-safe-bottom)]">
        {!empty ? (
          <>
            <Button type="button" className="h-12 w-full gap-2 text-base" onClick={onNew}>
              <Plus className="h-5 w-5" aria-hidden />
              {t('connectionScreen.newConnection')}
            </Button>
            <p className="px-1 text-center text-[11px] text-muted-foreground leading-relaxed">
              {t('mobile.betaDisclaimer')}
            </p>
          </>
        ) : null}
        <AppearanceControls variant="toolbar" side="top" />
      </footer>
    </div>
  )
}
