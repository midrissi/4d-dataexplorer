import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import {
  Clock,
  Copy,
  Database,
  Key,
  Lock,
  Pencil,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '~/i18n'
import { resolveLucideIcon } from '~/lib/lucide-icon'
import { COLOR_PRESETS, type ColorPreset } from '~/store/settings'
import type { ConnectionConfig } from '~desktop/lib/connection-store'

type ConnectionCardProps = {
  connection: ConnectionConfig
  /** Highlight the most recently used connection at the top of the list. */
  featured?: boolean
  onConnect: (connection: ConnectionConfig) => void
  onEdit: (connection: ConnectionConfig) => void
  onDuplicate: (connection: ConnectionConfig) => void
  onDelete: (id: string) => void
}

function formatLastUsed(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function MetaIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 text-muted-foreground" role="img" aria-label={label}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ConnectionCard({
  connection,
  featured = false,
  onConnect,
  onEdit,
  onDuplicate,
  onDelete,
}: ConnectionCardProps) {
  const { t } = useTranslation()
  const colorPreset =
    connection.color && connection.color in COLOR_PRESETS
      ? COLOR_PRESETS[connection.color as ColorPreset]
      : COLOR_PRESETS.default
  const Icon = resolveLucideIcon(connection.icon ?? 'Database') ?? Database
  const readonly = Boolean(connection.readonly)
  const skipSSL = Boolean(connection.skipSSL)
  const warnAccent = readonly || skipSSL
  const hasAuth = Boolean(connection.accessKey || connection.username)

  return (
    <TooltipProvider delayDuration={200}>
      {/* biome-ignore lint/a11y/useSemanticElements: card contains nested edit/delete buttons, so it cannot be a native <button> */}
      <div
        className={cn(
          'group relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-border bg-card/90 px-2 py-1 shadow-xs transition-colors hover:border-primary/50 hover:bg-accent/50',
          featured && !warnAccent && 'border-primary/35 bg-primary/5 ring-1 ring-primary/15',
          warnAccent && 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
        )}
        onClick={() => onConnect(connection)}
        onKeyDown={(e) => e.key === 'Enter' && onConnect(connection)}
        role="button"
        tabIndex={0}
      >
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-0.5',
            warnAccent ? 'bg-amber-500/70' : featured ? 'bg-primary' : colorPreset.bg
          )}
          aria-hidden
        />

        <div className="relative shrink-0">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-sm shadow-xs',
              colorPreset.bg,
              warnAccent && 'opacity-90'
            )}
          >
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          {readonly ? (
            <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-1 ring-card">
              <Lock className="h-2 w-2 text-white" />
            </span>
          ) : skipSSL ? (
            <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-1 ring-card">
              <ShieldAlert className="h-2 w-2 text-white" />
            </span>
          ) : featured ? (
            <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-1 ring-card">
              <Sparkles className="h-2 w-2 text-primary-foreground" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5 pr-14">
            <p className="truncate font-medium text-xs">{connection.name || connection.baseUrl}</p>
            {featured ? (
              <span className="shrink-0 rounded-sm bg-primary/15 px-1 py-px font-medium text-[9px] text-primary uppercase tracking-wide">
                {t('connectionScreen.sidebarLastBadge')}
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <p className="min-w-0 truncate font-mono">{connection.baseUrl}</p>
            <span className="shrink-0 text-border" aria-hidden>
              ·
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
              <Clock className="h-2.5 w-2.5" />
              {formatLastUsed(connection.lastUsed)}
            </span>
            {hasAuth ? (
              <>
                <span className="shrink-0 text-border" aria-hidden>
                  ·
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  {connection.accessKey ? (
                    <MetaIcon label="Access Key">
                      <Key className="h-2.5 w-2.5" />
                    </MetaIcon>
                  ) : null}
                  {connection.username ? (
                    <MetaIcon label="Basic Authentication">
                      <UserRound className="h-2.5 w-2.5" />
                    </MetaIcon>
                  ) : null}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="absolute top-0.5 right-0.5 flex items-center rounded-sm border border-border bg-card/95 opacity-0 shadow-xs backdrop-blur-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(connection)
                }}
                aria-label="Edit connection"
              >
                <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit connection</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate(connection)
                }}
                aria-label="Duplicate connection"
              >
                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate connection</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(connection.id)
                }}
                aria-label="Remove connection"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove connection</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
