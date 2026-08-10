import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Check, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { effectiveEnvValue } from '~/lib/env/merge-active'
import type { EnvVariable } from '~/lib/env/types'
import { getCurrentBaseId } from '~/lib/storage'
import { useActiveEnvironmentLabels, useEnvironmentsStore } from '~/store/environments'
import { useTabsStore } from '~/store/tabs'

function EnvColorDot({
  color,
  empty = false,
  className,
}: {
  color?: string
  empty?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-full border border-border',
        empty && 'bg-transparent',
        className
      )}
      style={empty ? undefined : { backgroundColor: color || '#94a3b8' }}
      aria-hidden
    />
  )
}

function EnvChip({
  name,
  color,
  emptyLabel,
}: {
  name: string | null
  color?: string
  emptyLabel: string
}) {
  return (
    <span className="inline-flex max-w-36 items-center gap-1 truncate rounded px-1 py-0.5 text-[11px]">
      <EnvColorDot color={color} empty={!name} />
      <span className="truncate">{name || emptyLabel}</span>
    </span>
  )
}

type PreviewVar = {
  key: string
  value: string
  secret: boolean
  scopeLabel: string
}

function maskSecret(value: string): string {
  if (!value) return '••••'
  return '•'.repeat(Math.min(Math.max(value.length, 4), 12))
}

export function EnvSwitcher({
  side = 'top',
  align = 'end',
  size = 'sm',
}: {
  side?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  size?: 'sm' | 'default'
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [revealSecrets, setRevealSecrets] = useState(false)
  const revision = useEnvironmentsStore((s) => s.revision)
  const globals = useEnvironmentsStore((s) => s.globals)
  void revision
  const { profile, base } = useActiveEnvironmentLabels()
  const profileBlock = useEnvironmentsStore((s) => s.getProfileBlock)()
  const baseBlock = useEnvironmentsStore((s) => s.getBaseBlock)()
  const setActiveProfileEnvironment = useEnvironmentsStore((s) => s.setActiveProfileEnvironment)
  const setActiveBaseEnvironment = useEnvironmentsStore((s) => s.setActiveBaseEnvironment)
  const resetActiveEnvironmentToInitial = useEnvironmentsStore(
    (s) => s.resetActiveEnvironmentToInitial
  )
  const openEnvironmentsTab = useTabsStore((s) => s.openEnvironmentsTab)
  const hasBase = Boolean(getCurrentBaseId())

  const label =
    [profile?.name, base?.name].filter(Boolean).join(' · ') || t('environments.noEnvironment')
  const hasActiveEnv = Boolean(profile || base)

  const activeColorDots = (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {profile ? <EnvColorDot color={profile.color} /> : null}
      {base ? <EnvColorDot color={base.color} /> : null}
      {!hasActiveEnv ? <EnvColorDot empty /> : null}
    </span>
  )

  const previewVars = useMemo((): PreviewVar[] => {
    const byKey = new Map<string, PreviewVar>()
    const push = (variables: readonly EnvVariable[], scopeLabel: string) => {
      for (const variable of variables) {
        if (!variable.enabled) continue
        const key = variable.key.trim()
        if (!key) continue
        byKey.set(key, {
          key,
          value: effectiveEnvValue(variable),
          secret: variable.type === 'secret',
          scopeLabel,
        })
      }
    }
    // Lowest priority first so higher scopes overwrite (same as resolve).
    push(globals, t('environments.scopeGlobal'))
    if (profile) push(profile.variables, t('environments.scopeProfile'))
    if (base) push(base.variables, t('environments.scopeBase'))
    return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [globals, profile, base, t])

  const hasSecrets = previewVars.some((item) => item.secret)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={250}>
        <Tooltip
          onOpenChange={(tooltipOpen) => {
            if (!tooltipOpen) setRevealSecrets(false)
          }}
        >
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size={size === 'sm' ? 'sm' : 'default'}
                className={cn(
                  'h-6 gap-1 px-1.5 text-muted-foreground hover:text-foreground',
                  size === 'sm' && 'text-xs'
                )}
                aria-label={t('environments.switcherLabel')}
              >
                {activeColorDots}
                <span className="hidden max-w-40 truncate sm:inline">{label}</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!open ? (
            <TooltipContent side={side} className="max-w-80 p-0">
              <div className="flex items-center justify-between gap-2 border-border/60 border-b px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-1.5 font-medium text-[11px]">
                  <span className="shrink-0">{t('environments.switcherLabel')}</span>
                  {hasActiveEnv ? (
                    <span className="inline-flex min-w-0 items-center gap-1 font-normal text-muted-foreground">
                      <span aria-hidden>·</span>
                      {activeColorDots}
                      <span className="truncate">{label}</span>
                    </span>
                  ) : null}
                </div>
                {hasSecrets ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    onPointerDown={(event) => {
                      // Keep the hover tooltip open while toggling.
                      event.preventDefault()
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      setRevealSecrets((value) => !value)
                    }}
                    aria-label={
                      revealSecrets ? t('environments.hideSecrets') : t('environments.showSecrets')
                    }
                    aria-pressed={revealSecrets}
                  >
                    {revealSecrets ? (
                      <EyeOff className="h-3 w-3" aria-hidden />
                    ) : (
                      <Eye className="h-3 w-3" aria-hidden />
                    )}
                    <span>
                      {revealSecrets
                        ? t('environments.hideSecrets')
                        : t('environments.showSecrets')}
                    </span>
                  </button>
                ) : null}
              </div>
              {previewVars.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  {t('environments.switcherEmptyVars')}
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto overscroll-contain py-1">
                  {previewVars.map((item) => {
                    const showValue = !item.secret || revealSecrets
                    return (
                      <li
                        key={item.key}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-2.5 py-0.5 font-mono text-[11px]"
                      >
                        <span className="truncate text-foreground" title={item.key}>
                          {item.key}
                          <span className="ml-1 font-sans text-[10px] text-muted-foreground">
                            {item.scopeLabel}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'truncate text-right text-muted-foreground',
                            item.secret && !showValue && 'tracking-wider'
                          )}
                          title={showValue ? item.value : undefined}
                        >
                          {showValue ? item.value || '—' : maskSecret(item.value)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
      <PopoverContent side={side} align={align} className="w-72 space-y-3 p-2">
        <div className="space-y-1">
          <p className="px-1 font-medium text-muted-foreground text-xs">
            {t('environments.profileSection')}
          </p>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
            onClick={() => setActiveProfileEnvironment(null)}
          >
            <span className="w-4">{!profile ? <Check className="h-3.5 w-3.5" /> : null}</span>
            <EnvChip name={null} emptyLabel={t('environments.noEnvironment')} />
          </button>
          {profileBlock.environments.map((env) => (
            <button
              key={env.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              onClick={() => setActiveProfileEnvironment(env.id)}
            >
              <span className="w-4">
                {profile?.id === env.id ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <EnvChip name={env.name} color={env.color} emptyLabel={env.name} />
            </button>
          ))}
        </div>

        {hasBase ? (
          <div className="space-y-1 border-border border-t pt-2">
            <p className="px-1 font-medium text-muted-foreground text-xs">
              {t('environments.baseSection')}
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              onClick={() => setActiveBaseEnvironment(null)}
            >
              <span className="w-4">{!base ? <Check className="h-3.5 w-3.5" /> : null}</span>
              <EnvChip name={null} emptyLabel={t('environments.noEnvironment')} />
            </button>
            {baseBlock.environments.map((env) => (
              <button
                key={env.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                onClick={() => setActiveBaseEnvironment(env.id)}
              >
                <span className="w-4">
                  {base?.id === env.id ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <EnvChip name={env.name} color={env.color} emptyLabel={env.name} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1 border-border border-t pt-2">
          {(profile || base) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                if (base) resetActiveEnvironmentToInitial('base')
                if (profile) resetActiveEnvironmentToInitial('profile')
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {t('environments.resetActive')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => openEnvironmentsTab()}
          >
            {t('environments.manage')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
