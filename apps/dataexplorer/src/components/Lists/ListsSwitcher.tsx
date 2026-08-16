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
import { Database, List, Settings2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  isDataclassPickList,
  isValidPickListName,
  mergeScopedPickLists,
  type PickListDeclaration,
} from '~/lib/env'
import { useListsStore } from '~/store/lists'
import { useTabsStore } from '~/store/tabs'

type ScopeId = 'globals' | 'profile' | 'base'

type ListEntry = {
  id: string
  name: string
  type: 'dataclass' | 'hardcoded'
  scope: ScopeId
}

function ScopeIcon({ scope }: { scope: ScopeId }) {
  if (scope === 'profile')
    return <UserRound className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
  if (scope === 'base')
    return <Database className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
  return (
    <span
      className="size-2.5 shrink-0 rounded-full border border-muted-foreground/50 border-dashed"
      aria-hidden
    />
  )
}

function ScopeBadge({ scope, label }: { scope: ScopeId; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border/70 bg-muted/60 px-1 py-px font-sans text-[9px] text-muted-foreground leading-none">
      <ScopeIcon scope={scope} />
      {label}
    </span>
  )
}

/** Status-bar trigger button + tooltip + popover for the merged $lists. */
export function ListsSwitcher({
  side = 'top',
  align = 'start',
  size = 'sm',
}: {
  side?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  size?: 'sm' | 'default'
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const revision = useListsStore((s) => s.revision)
  const getScopedLists = useListsStore((s) => s.getScopedLists)
  void revision

  const openListsTab = useTabsStore((s) => s.openListsTab)

  const scopeLabel: Record<ScopeId, string> = {
    globals: t('lists.switcherScopeGlobals'),
    profile: t('lists.switcherScopeProfile'),
    base: t('lists.switcherScopeBase'),
  }

  const entries = (() => {
    const scoped = getScopedLists()
    // Collect per-scope entries; the merged view shows base > profile > globals precedence.
    const seen = new Set<string>()
    const result: ListEntry[] = []
    const push = (decls: PickListDeclaration[], scope: ScopeId) => {
      for (const d of decls) {
        const name = d.name.trim()
        if (!name || !isValidPickListName(name)) continue
        result.push({
          id: d.id,
          name,
          type: isDataclassPickList(d) ? 'dataclass' : 'hardcoded',
          scope,
        })
        seen.add(name)
      }
    }
    push(scoped.base, 'base')
    push(scoped.profile, 'profile')
    push(scoped.globals, 'globals')
    // Deduplicate by name (base > profile > globals wins, already pushed first).
    const merged = mergeScopedPickLists(scoped)
    const mergedNames = new Set(merged.map((d) => d.name.trim()))
    return result
      .filter((e) => mergedNames.has(e.name))
      .filter((e, i, arr) => arr.findIndex((x) => x.name === e.name) === i)
      .sort((a, b) => a.name.localeCompare(b.name))
  })()

  const count = entries.length
  const countLabel =
    count === 1 ? t('lists.switcherCountOne') : t('lists.switcherCount', { count: String(count) })
  const triggerLabel = count > 0 ? countLabel : t('lists.switcherEmpty')

  const openManage = () => {
    setOpen(false)
    openListsTab()
  }

  const tooltipContent = (
    <div className="overflow-hidden">
      <div className="flex items-center gap-1.5 border-border/60 border-b bg-muted/40 px-2.5 py-2">
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-xs"
          aria-hidden
        >
          <List className="size-3" />
        </span>
        <span className="font-medium text-[11px] text-foreground">{t('lists.switcherLabel')}</span>
        {count > 0 ? (
          <span className="rounded-full border border-border/70 bg-background/80 px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      {count === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
          <span
            className="flex size-8 items-center justify-center rounded-lg border border-border/70 border-dashed bg-muted/30 text-muted-foreground"
            aria-hidden
          >
            <List className="size-3.5" />
          </span>
          <p className="text-[11px] text-muted-foreground">{t('lists.switcherEmpty')}</p>
        </div>
      ) : (
        <ul className="max-h-52 overflow-y-auto overscroll-contain py-1">
          {entries.map((entry) => (
            <li
              key={entry.name}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2.5 py-1 transition-colors duration-150 hover:bg-muted/40"
            >
              <span className="min-w-0 truncate font-mono text-[11px] text-foreground">
                {entry.name}
              </span>
              <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1 py-px font-mono text-[9px] text-muted-foreground">
                {entry.type === 'dataclass' ? t('lists.typeDataclass') : t('lists.typeHardcoded')}
              </span>
              <ScopeBadge scope={entry.scope} label={scopeLabel[entry.scope]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size={size === 'sm' ? 'sm' : 'default'}
                className={cn(
                  'h-6 gap-1 px-1.5 text-[11px] transition-colors duration-150',
                  count > 0
                    ? 'text-foreground hover:bg-muted'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  open && 'bg-muted text-foreground'
                )}
                aria-label={`${t('lists.switcherLabel')}: ${triggerLabel}`}
              >
                <List className="size-3 shrink-0" aria-hidden />
                <span className="font-mono tabular-nums">{count > 0 ? count : null}</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!open ? (
            <TooltipContent side={side} className="max-w-72 overflow-hidden p-0">
              {tooltipContent}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        side={side}
        align={align}
        className="z-100 w-72 overflow-hidden border-border bg-background p-0 text-foreground shadow-md"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="border-border/60 border-b bg-muted/60 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-xs"
              aria-hidden
            >
              <List className="size-3" />
            </span>
            <p className="min-w-0 flex-1 font-medium text-[11px] text-foreground leading-none">
              {t('lists.switcherLabel')}
            </p>
            {count > 0 ? (
              <span className="rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
                {countLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="bg-background">
          {count === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-3 py-5 text-center">
              <span
                className="flex size-8 items-center justify-center rounded-lg border border-border/70 border-dashed bg-muted/30 text-muted-foreground"
                aria-hidden
              >
                <List className="size-3.5" />
              </span>
              <p className="text-[11px] text-muted-foreground">{t('lists.switcherEmpty')}</p>
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto overscroll-contain py-1">
              {entries.map((entry) => (
                <li
                  key={entry.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2.5 py-1.5 transition-colors duration-150 hover:bg-muted/40"
                >
                  <span className="min-w-0 truncate font-mono text-[11px] text-foreground">
                    {entry.name}
                  </span>
                  <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1 py-px font-mono text-[9px] text-muted-foreground">
                    {entry.type === 'dataclass'
                      ? t('lists.typeDataclass')
                      : t('lists.typeHardcoded')}
                  </span>
                  <ScopeBadge scope={entry.scope} label={scopeLabel[entry.scope]} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end border-border/60 border-t bg-muted/60 px-1.5 py-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={openManage}
          >
            <Settings2 className="size-3 shrink-0" aria-hidden />
            {t('lists.switcherManage')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
