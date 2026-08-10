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
import { Check, Database, Eye, EyeOff, RotateCcw, UserRound } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
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
        empty ? 'bg-transparent' : 'border-transparent',
        className
      )}
      style={empty ? undefined : { backgroundColor: color || 'var(--muted-foreground)' }}
      aria-hidden
    />
  )
}

/** Compact footer/trigger readout for the active profile + database environments. */
function EnvActiveSummary({
  profile,
  base,
  emptyLabel,
  className,
}: {
  profile: { name: string; color?: string } | null | undefined
  base: { name: string; color?: string } | null | undefined
  emptyLabel: string
  className?: string
}) {
  if (!profile && !base) {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-muted-foreground/40 border-dashed"
          aria-hidden
        >
          <span className="size-1 rounded-full bg-muted-foreground/40" />
        </span>
        <span className="truncate text-muted-foreground">{emptyLabel}</span>
      </span>
    )
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      {profile ? (
        <span
          className="inline-flex max-w-30 items-center gap-1 truncate rounded-sm border border-border bg-background px-1 py-px"
          title={profile.name}
        >
          <span
            className="h-3 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: profile.color || 'var(--muted-foreground)' }}
            aria-hidden
          />
          <UserRound className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate font-mono text-[10px] text-foreground leading-none">
            {profile.name}
          </span>
        </span>
      ) : null}
      {base ? (
        <span
          className="inline-flex max-w-30 items-center gap-1 truncate rounded-sm border border-border bg-background px-1 py-px"
          title={base.name}
        >
          <span
            className="h-3 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: base.color || 'var(--muted-foreground)' }}
            aria-hidden
          />
          <Database className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate font-mono text-[10px] text-foreground leading-none">
            {base.name}
          </span>
        </span>
      ) : null}
    </span>
  )
}

function EnvChip({
  name,
  color,
  emptyLabel,
  className,
}: {
  name: string | null
  color?: string
  emptyLabel: string
  className?: string
}) {
  const label = name || emptyLabel
  return (
    <span
      className={cn(
        'inline-flex min-w-0 flex-1 items-center gap-1.5 text-left font-mono text-[11px]',
        className
      )}
      title={label}
    >
      <EnvColorDot color={color} empty={!name} />
      <span className={cn('min-w-0 truncate', !name && 'text-muted-foreground')}>{label}</span>
    </span>
  )
}

function EnvOptionButton({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'relative flex w-full items-center gap-1.5 border-border/50 border-b bg-background px-2 py-1 text-left last:border-b-0',
        'transition-colors hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected && 'bg-accent'
      )}
      onClick={onSelect}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-primary"
        />
      ) : null}
      <span
        className={cn(
          'flex size-3.5 shrink-0 items-center justify-center',
          selected ? 'text-primary' : 'text-transparent'
        )}
        aria-hidden
      >
        <Check className="size-3" strokeWidth={2.5} />
      </span>
      {children}
    </button>
  )
}

function EnvSection({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="bg-background">
      <div className="flex items-center gap-1.5 border-border/50 border-b bg-muted px-2 py-1">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <p className="min-w-0 flex-1 truncate font-medium text-[11px] text-muted-foreground">
          {title}
        </p>
        {count > 0 ? (
          <span className="rounded-full border border-border bg-background px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      <div role="listbox" className="max-h-40 overflow-y-auto overscroll-contain bg-background">
        {children}
      </div>
    </section>
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

  const activeSummary = (
    <EnvActiveSummary profile={profile} base={base} emptyLabel={t('environments.noEnvironment')} />
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
  const profileCount = profileBlock.environments.length
  const baseCount = baseBlock.environments.length

  const selectProfileEnvironment = (id: string | null) => {
    setActiveProfileEnvironment(id)
    setOpen(false)
  }

  const selectBaseEnvironment = (id: string | null) => {
    setActiveBaseEnvironment(id)
    setOpen(false)
  }

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
                  'h-6 max-w-[18rem] gap-1 px-1 text-[11px] transition-colors',
                  hasActiveEnv
                    ? 'text-foreground hover:bg-muted'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  open && 'bg-muted text-foreground'
                )}
                aria-label={`${t('environments.switcherLabel')}: ${label}`}
              >
                <span className="hidden min-w-0 sm:inline-flex">{activeSummary}</span>
                <span className="inline-flex items-center gap-1 sm:hidden">
                  {profile ? <EnvColorDot color={profile.color} /> : null}
                  {base ? <EnvColorDot color={base.color} /> : null}
                  {!hasActiveEnv ? <EnvColorDot empty /> : null}
                </span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!open ? (
            <TooltipContent side={side} className="max-w-80 p-0">
              <div className="flex items-center justify-between gap-2 border-border/60 border-b px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-1.5 font-medium text-[11px]">
                  <span className="shrink-0 text-muted-foreground">
                    {t('environments.switcherLabel')}
                  </span>
                  {hasActiveEnv ? (
                    <span className="min-w-0 font-normal">{activeSummary}</span>
                  ) : null}
                </div>
                {hasSecrets ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <PopoverContent
        side={side}
        align={align}
        className="z-100 w-72 overflow-hidden border-border bg-background p-0 text-foreground opacity-100 shadow-md"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="flex items-center gap-2 border-border border-b bg-muted px-2 py-1">
          <div className="min-w-0 flex-1">{activeSummary}</div>
          <span className="shrink-0 font-medium text-[10px] text-muted-foreground">
            {t('environments.switcherLabel')}
          </span>
        </div>

        <div className="bg-background">
          <EnvSection
            icon={<UserRound className="size-3" aria-hidden />}
            title={t('environments.profileSection')}
            count={profileCount}
          >
            <EnvOptionButton selected={!profile} onSelect={() => selectProfileEnvironment(null)}>
              <EnvChip name={null} emptyLabel={t('environments.noEnvironment')} />
            </EnvOptionButton>
            {profileBlock.environments.map((env) => (
              <EnvOptionButton
                key={env.id}
                selected={profile?.id === env.id}
                onSelect={() => selectProfileEnvironment(env.id)}
              >
                <EnvChip name={env.name} color={env.color} emptyLabel={env.name} />
              </EnvOptionButton>
            ))}
          </EnvSection>

          {hasBase ? (
            <EnvSection
              icon={<Database className="size-3" aria-hidden />}
              title={t('environments.baseSection')}
              count={baseCount}
            >
              <EnvOptionButton selected={!base} onSelect={() => selectBaseEnvironment(null)}>
                <EnvChip name={null} emptyLabel={t('environments.noEnvironment')} />
              </EnvOptionButton>
              {baseBlock.environments.map((env) => (
                <EnvOptionButton
                  key={env.id}
                  selected={base?.id === env.id}
                  onSelect={() => selectBaseEnvironment(env.id)}
                >
                  <EnvChip name={env.name} color={env.color} emptyLabel={env.name} />
                </EnvOptionButton>
              ))}
            </EnvSection>
          ) : null}
        </div>

        <div className="flex items-center gap-1 border-border border-t bg-muted px-1.5 py-1">
          {profile || base ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 min-w-0 flex-1 justify-start gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (base) resetActiveEnvironmentToInitial('base')
                if (profile) resetActiveEnvironmentToInitial('profile')
              }}
            >
              <RotateCcw className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{t('environments.resetActive')}</span>
            </Button>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => openEnvironmentsTab()}
          >
            {t('environments.manage')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
