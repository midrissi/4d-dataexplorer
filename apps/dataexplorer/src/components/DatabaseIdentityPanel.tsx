import { ClickToCopy, cn } from '@4d/ui'
import { Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { eventBus } from '~/lib/eventBus'

export type DatabaseIdentity = {
  uniqId: string | null
  baseId: string | null
  name: string | null
}

export function useDatabaseIdentity(): DatabaseIdentity | null {
  const [identity, setIdentity] = useState<DatabaseIdentity | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadIdentity() {
      try {
        const next = await api.getDatabaseIdentity()
        if (!cancelled) setIdentity(next)
      } catch {
        if (!cancelled) setIdentity(null)
      }
    }

    void loadIdentity()
    const subscription = eventBus.on('catalog-reloaded', () => {
      void loadIdentity()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return identity
}

function IdentityRow({
  label,
  value,
  copyLabel,
  copiedLabel,
}: {
  label: string
  value: string
  copyLabel: string
  copiedLabel: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <ClickToCopy
        as="code"
        value={value}
        tooltipLabel={copyLabel}
        tooltipCopiedLabel={copiedLabel}
        className="mt-0.5 inline-flex max-w-full truncate rounded-md bg-primary/10 px-2 py-1 font-mono text-primary text-xs hover:bg-primary/20"
      >
        {value}
      </ClickToCopy>
    </div>
  )
}

/**
 * Compact header chip: always-visible, click-to-copy database ID (__BASEID).
 */
export function DatabaseIdentityHeaderChip({ className }: { className?: string }) {
  const { t } = useTranslation()
  const identity = useDatabaseIdentity()
  const databaseId = identity?.baseId

  if (!identity || !databaseId) return null

  return (
    <ClickToCopy
      as="code"
      value={databaseId}
      tooltipLabel={
        identity.name ? `${identity.name} · ${t('common.clickToCopy')}` : t('common.clickToCopy')
      }
      tooltipCopiedLabel={t('common.copied')}
      aria-label={t('welcome.baseId')}
      className={cn(
        'hidden max-w-44 items-center gap-1.5 truncate rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground',
        'transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'sm:inline-flex',
        className
      )}
    >
      <Database className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate">{databaseId}</span>
    </ClickToCopy>
  )
}

/**
 * Shows the connected database name and copyable catalog IDs (__UNIQID / __BASEID).
 */
export function DatabaseIdentityPanel({
  className,
  compact = false,
}: {
  className?: string
  /** Tighter layout for embedding inside another card. */
  compact?: boolean
}) {
  const { t } = useTranslation()
  const identity = useDatabaseIdentity()

  if (!identity?.uniqId && !identity?.baseId && !identity?.name) return null

  const copyLabel = t('common.clickToCopy')
  const copiedLabel = t('common.copied')

  return (
    <div className={cn(compact ? 'space-y-3' : 'rounded-xl border bg-card p-4', className)}>
      {!compact ? (
        <h3 className="mb-3 flex items-center gap-2 font-medium text-foreground">
          <Database className="h-4 w-4 text-primary" />
          {t('welcome.database')}
        </h3>
      ) : null}
      <div className={cn('grid gap-3', identity.name || identity.uniqId ? 'sm:grid-cols-2' : '')}>
        {identity.name ? (
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">{t('welcome.databaseName')}</p>
            <p className="mt-0.5 truncate font-medium text-foreground text-sm">{identity.name}</p>
          </div>
        ) : null}
        {identity.baseId ? (
          <IdentityRow
            label={t('welcome.baseId')}
            value={identity.baseId}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
        ) : null}
        {identity.uniqId && identity.uniqId !== identity.baseId ? (
          <IdentityRow
            label={t('welcome.databaseId')}
            value={identity.uniqId}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
        ) : null}
      </div>
    </div>
  )
}
