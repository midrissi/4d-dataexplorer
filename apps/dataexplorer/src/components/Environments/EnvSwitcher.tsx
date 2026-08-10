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
import {
  Check,
  Database,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  RotateCcw,
  Settings2,
  UserRound,
  Variable,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { EnvTemplatePlaygroundDialog } from '~/components/Environments/EnvTemplatePlaygroundDialog'
import { useTranslation } from '~/i18n'
import { effectiveEnvValue } from '~/lib/env/merge-active'
import type { EnvVariable } from '~/lib/env/types'
import { getCurrentBaseId } from '~/lib/storage'
import { useActiveEnvironmentLabels, useEnvironmentsStore } from '~/store/environments'
import { useTabsStore } from '~/store/tabs'

type EnvScope = 'global' | 'profile' | 'base'

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

function EnvScopeAccent({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      className={cn('h-3 w-0.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color || 'var(--muted-foreground)' }}
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
          className="inline-flex max-w-30 items-center gap-1 truncate rounded-md border border-border/80 bg-background/90 px-1.5 py-0.5 shadow-xs"
          title={profile.name}
        >
          <EnvScopeAccent color={profile.color} />
          <UserRound className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate font-mono text-[10px] text-foreground leading-none">
            {profile.name}
          </span>
        </span>
      ) : null}
      {base ? (
        <span
          className="inline-flex max-w-30 items-center gap-1 truncate rounded-md border border-border/80 bg-background/90 px-1.5 py-0.5 shadow-xs"
          title={base.name}
        >
          <EnvScopeAccent color={base.color} />
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
        'group/option relative flex w-full items-center gap-1.5 border-border/40 border-b bg-background px-2 py-1.5 text-left last:border-b-0',
        'transition-colors duration-150 hover:bg-muted/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected && 'bg-accent/80'
      )}
      onClick={onSelect}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary"
        />
      ) : null}
      <span
        className={cn(
          'flex size-3.5 shrink-0 items-center justify-center rounded-sm transition-colors duration-150',
          selected
            ? 'bg-primary/15 text-primary'
            : 'text-transparent group-hover/option:text-muted-foreground/50'
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
  empty,
  children,
}: {
  icon: ReactNode
  title: string
  count: number
  empty?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-background">
      <div className="flex items-center gap-1.5 border-border/50 border-b bg-muted/80 px-2 py-1.5">
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground shadow-xs"
          aria-hidden
        >
          {icon}
        </span>
        <p className="min-w-0 flex-1 truncate font-medium text-[11px] text-foreground/80">
          {title}
        </p>
        <span className="rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <div role="listbox" className="max-h-40 overflow-y-auto overscroll-contain bg-background">
        {count === 0 && empty ? empty : children}
      </div>
    </section>
  )
}

type PreviewVar = {
  key: string
  value: string
  secret: boolean
  scope: EnvScope
  scopeLabel: string
  accent?: string
}

function maskSecret(value: string): string {
  if (!value) return '••••'
  return '•'.repeat(Math.min(Math.max(value.length, 4), 12))
}

function ScopeBadge({ scope, label, accent }: { scope: EnvScope; label: string; accent?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-sm border px-1 py-px font-sans text-[9px] leading-none',
        scope === 'global' && 'border-border/70 bg-muted/60 text-muted-foreground',
        scope === 'profile' && 'border-border/70 bg-background text-muted-foreground',
        scope === 'base' && 'border-border/70 bg-background text-muted-foreground'
      )}
    >
      {scope !== 'global' ? <EnvScopeAccent color={accent} className="h-2.5" /> : null}
      {label}
    </span>
  )
}

function EnvVarsPreview({
  vars,
  revealSecrets,
  onToggleSecrets,
  hasSecrets,
  title,
  activeSummary,
  emptyLabel,
  showSecretsLabel,
  hideSecretsLabel,
}: {
  vars: PreviewVar[]
  revealSecrets: boolean
  onToggleSecrets: () => void
  hasSecrets: boolean
  title: string
  activeSummary: ReactNode
  emptyLabel: string
  showSecretsLabel: string
  hideSecretsLabel: string
}) {
  return (
    <div className="overflow-hidden">
      <div className="border-border/60 border-b bg-muted/40 px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-xs"
                aria-hidden
              >
                <Variable className="size-3" />
              </span>
              <span className="font-medium text-[11px] text-foreground">{title}</span>
              {vars.length > 0 ? (
                <span className="rounded-full border border-border/70 bg-background/80 px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
                  {vars.length}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 pl-0.5">{activeSummary}</div>
          </div>
          {hasSecrets ? (
            <button
              type="button"
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background/90 px-1.5 py-1 text-[10px] text-muted-foreground shadow-xs',
                'transition-colors duration-150 hover:border-border hover:bg-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              onPointerDown={(event) => {
                // Keep the hover tooltip open while toggling.
                event.preventDefault()
              }}
              onClick={(event) => {
                event.stopPropagation()
                onToggleSecrets()
              }}
              aria-label={revealSecrets ? hideSecretsLabel : showSecretsLabel}
              aria-pressed={revealSecrets}
            >
              {revealSecrets ? (
                <EyeOff className="size-3" aria-hidden />
              ) : (
                <Eye className="size-3" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {revealSecrets ? hideSecretsLabel : showSecretsLabel}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {vars.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
          <span
            className="flex size-8 items-center justify-center rounded-lg border border-border/70 border-dashed bg-muted/30 text-muted-foreground"
            aria-hidden
          >
            <Variable className="size-3.5" />
          </span>
          <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="max-h-56 overflow-y-auto overscroll-contain py-1">
          {vars.map((item) => {
            const showValue = !item.secret || revealSecrets
            return (
              <li
                key={item.key}
                className="group/row relative grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-2 px-2.5 py-1 transition-colors duration-150 hover:bg-muted/50"
              >
                <span
                  aria-hidden
                  className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full opacity-70"
                  style={{
                    backgroundColor:
                      item.scope === 'global'
                        ? 'var(--muted-foreground)'
                        : item.accent || 'var(--muted-foreground)',
                  }}
                />
                <span className="flex min-w-0 items-center gap-1.5 pl-1.5">
                  <span
                    className="min-w-0 truncate font-mono text-[11px] text-foreground"
                    title={item.key}
                  >
                    {item.key}
                  </span>
                  <ScopeBadge scope={item.scope} label={item.scopeLabel} accent={item.accent} />
                </span>
                <span
                  className={cn(
                    'flex min-w-0 items-center justify-end gap-1 font-mono text-[11px] text-muted-foreground',
                    item.secret && !showValue && 'tracking-wider'
                  )}
                  title={showValue ? item.value : undefined}
                >
                  {item.secret && !showValue ? (
                    <Lock className="size-2.5 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                  <span className="truncate">
                    {showValue ? item.value || '—' : maskSecret(item.value)}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
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
  const [playgroundOpen, setPlaygroundOpen] = useState(false)
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
    const push = (
      variables: readonly EnvVariable[],
      scope: EnvScope,
      scopeLabel: string,
      accent?: string
    ) => {
      for (const variable of variables) {
        if (!variable.enabled) continue
        const key = variable.key.trim()
        if (!key) continue
        byKey.set(key, {
          key,
          value: effectiveEnvValue(variable),
          secret: variable.type === 'secret',
          scope,
          scopeLabel,
          accent,
        })
      }
    }
    // Lowest priority first so higher scopes overwrite (same as resolve).
    push(globals, 'global', t('environments.scopeGlobal'))
    if (profile) push(profile.variables, 'profile', t('environments.scopeProfile'), profile.color)
    if (base) push(base.variables, 'base', t('environments.scopeBase'), base.color)
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

  const openManage = () => {
    setOpen(false)
    openEnvironmentsTab()
  }

  const openPlayground = () => {
    setOpen(false)
    setPlaygroundOpen(true)
  }

  const emptySection = (
    <div className="px-2.5 py-3 text-center">
      <p className="text-[11px] text-muted-foreground">{t('environments.switcherEmptySection')}</p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-1 h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={openManage}
      >
        {t('environments.manage')}
      </Button>
    </div>
  )

  return (
    <>
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
                    'h-6 max-w-[18rem] gap-1 px-1 text-[11px] transition-colors duration-150',
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
              <TooltipContent side={side} className="max-w-80 overflow-hidden p-0">
                <EnvVarsPreview
                  vars={previewVars}
                  revealSecrets={revealSecrets}
                  onToggleSecrets={() => setRevealSecrets((value) => !value)}
                  hasSecrets={hasSecrets}
                  title={t('environments.switcherLabel')}
                  activeSummary={
                    hasActiveEnv ? (
                      activeSummary
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {t('environments.noEnvironment')}
                      </span>
                    )
                  }
                  emptyLabel={t('environments.switcherEmptyVars')}
                  showSecretsLabel={t('environments.showSecrets')}
                  hideSecretsLabel={t('environments.hideSecrets')}
                />
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
          <div className="border-border border-b bg-muted/70 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-xs"
                aria-hidden
              >
                <Variable className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[11px] text-foreground leading-none">
                  {t('environments.switcherLabel')}
                </p>
                <div className="mt-1 min-w-0">{activeSummary}</div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border/60 bg-background">
            <EnvSection
              icon={<UserRound className="size-3" aria-hidden />}
              title={t('environments.profileSection')}
              count={profileCount}
              empty={emptySection}
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
                empty={emptySection}
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

          <div className="flex items-center gap-1 border-border border-t bg-muted/70 px-1.5 py-1">
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
              className="h-6 shrink-0 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={openPlayground}
            >
              <FlaskConical className="size-3 shrink-0" aria-hidden />
              {t('environments.testTemplates')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={openManage}
            >
              <Settings2 className="size-3 shrink-0" aria-hidden />
              {t('environments.manage')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <EnvTemplatePlaygroundDialog open={playgroundOpen} onOpenChange={setPlaygroundOpen} />
    </>
  )
}
