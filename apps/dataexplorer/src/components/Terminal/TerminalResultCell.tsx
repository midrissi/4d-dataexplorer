import { Button, ClickToCopy, cn } from '@4d/ui'
import {
  Binary,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  KeyRound,
  Rows3,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import { ConsoleValue, ObjectTree } from '~/components/Console/ObjectTree'
import { PrivateBinaryResult } from '~/components/DecodedBinary/PrivateBinaryResult'
import { DeferredImage } from '~/components/DeferredImage'
import { useTranslation } from '~/i18n'
import type { FormattedTerminalResult } from '~/lib/terminal'
import { isDataclassTab, useTabsStore } from '~/store/tabs'

function EntityCell({ result }: { result: Extract<FormattedTerminalResult, { kind: 'entity' }> }) {
  const { t } = useTranslation()
  const openTab = useTabsStore((s) => s.openTab)
  const setSelectedEntityId = useTabsStore((s) => s.setSelectedEntityId)

  const openEntity = () => {
    if (!result.dataClass || !result.entityKey) return
    openTab(result.dataClass)
    const { tabs, activeTabId } = useTabsStore.getState()
    const tabId =
      activeTabId &&
      tabs.some(
        (tab) =>
          tab.id === activeTabId &&
          isDataclassTab(tab) &&
          tab.dataclassName === result.dataClass &&
          !tab.entitySetId
      )
        ? activeTabId
        : tabs.find(
            (tab) =>
              isDataclassTab(tab) && tab.dataclassName === result.dataClass && !tab.entitySetId
          )?.id
    if (tabId) setSelectedEntityId(tabId, result.entityKey)
  }

  return (
    <div className="inline-flex h-5 max-w-full items-center gap-1 rounded border border-sky-500/25 bg-sky-500/8 px-1.5 dark:bg-sky-500/10">
      <span className="truncate font-mono text-[11px] text-sky-700 leading-none dark:text-sky-300">
        {result.label}
      </span>
      {result.entityKey ? (
        <ClickToCopy
          value={result.entityKey}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="inline-flex h-4 items-center gap-0.5 rounded border border-sky-500/20 bg-background/80 px-1 font-mono text-[10px] text-muted-foreground leading-none transition-colors hover:bg-accent"
        >
          <KeyRound className="h-2.5 w-2.5 text-sky-600 dark:text-sky-400" aria-hidden />
          {result.entityKey}
        </ClickToCopy>
      ) : null}
      {result.dataClass && result.entityKey ? (
        <Button
          size="xs"
          variant="ghost"
          className="h-4 gap-0.5 px-1 text-[10px] text-sky-800 leading-none hover:bg-sky-500/15 hover:text-sky-900 dark:text-sky-200 dark:hover:text-sky-100"
          onClick={openEntity}
        >
          <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          {t('terminal.openEntity')}
        </Button>
      ) : null}
    </div>
  )
}

function SelectionCell({
  result,
}: {
  result: Extract<FormattedTerminalResult, { kind: 'entitysel' }>
}) {
  const { t } = useTranslation()
  const openEntitySetTab = useTabsStore((s) => s.openEntitySetTab)
  const openTab = useTabsStore((s) => s.openTab)

  const openAll = () => {
    if (!result.dataClass) return
    if (result.entitySetId) {
      openEntitySetTab({
        dataclassName: result.dataClass,
        entitySetId: result.entitySetId,
        customTitle: `${result.dataClass} terminal`,
        forceNew: true,
      })
      return
    }
    openTab(result.dataClass)
  }

  return (
    <div className="inline-flex h-5 max-w-full items-center gap-1 rounded border border-violet-500/25 bg-violet-500/8 px-1.5 dark:bg-violet-500/10">
      <span className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-[11px] text-violet-700 leading-none dark:text-violet-300">
        <Rows3 className="h-2.5 w-2.5 shrink-0" aria-hidden />
        {result.label}
      </span>
      <span className="shrink-0 rounded-full bg-violet-500/15 px-1.5 text-[10px] text-violet-700 tabular-nums leading-4 dark:text-violet-300">
        {t('terminal.entityCount', { count: result.count })}
      </span>
      <Button
        size="xs"
        variant="outline"
        className="h-4 gap-0.5 border-violet-500/30 bg-background/70 px-1 text-[10px] text-violet-800 leading-none hover:bg-violet-500/10 dark:text-violet-200"
        onClick={openAll}
        disabled={!result.dataClass}
      >
        <ExternalLink className="h-2.5 w-2.5" aria-hidden />
        {t('terminal.openInTab')}
      </Button>
    </div>
  )
}

function ExpandChip({
  open,
  onToggle,
  icon,
  label,
  toneClass,
  children,
}: {
  open: boolean
  onToggle: () => void
  icon: ReactNode
  label: string
  toneClass: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        className={cn(
          'inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[11px] leading-none transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          toneClass
        )}
        onClick={onToggle}
        aria-expanded={open}
      >
        {icon}
        {label}
        {open ? (
          <ChevronDown className="h-2.5 w-2.5 opacity-70" aria-hidden />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 opacity-70" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="fade-in-0 slide-in-from-top-1 mt-1.5 animate-in overflow-auto rounded-md border border-border/70 bg-muted/10 p-2 duration-150">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function BinaryCell({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  if (!isPrivateBinaryObject(value)) {
    return <ConsoleValue value={value} />
  }
  return (
    <ExpandChip
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<Binary className="h-3 w-3" aria-hidden />}
      label={t('terminal.binaryObject')}
      toneClass="border-amber-500/25 bg-amber-500/8 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <div className="max-h-80 overflow-auto">
        <PrivateBinaryResult value={value} />
      </div>
    </ExpandChip>
  )
}

function ImageCell({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  return (
    <ExpandChip
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<ImageIcon className="h-3 w-3" aria-hidden />}
      label={t('terminal.image')}
      toneClass="border-emerald-500/25 bg-emerald-500/8 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      <DeferredImage value={value} className="max-h-48 max-w-full rounded object-contain" />
    </ExpandChip>
  )
}

function OtherCell({ result }: { result: Extract<FormattedTerminalResult, { kind: 'other' }> }) {
  const value = result.value
  if (value !== null && typeof value === 'object') {
    return (
      <div className="min-w-0 flex-1 overflow-auto">
        <ObjectTree value={value} defaultOpen={false} gutter={false} />
      </div>
    )
  }
  return (
    <span className="font-mono text-[11px] text-foreground/90">
      <ConsoleValue value={value} gutter={false} />
    </span>
  )
}

export function TerminalResultCell({
  formatted,
  className,
}: {
  formatted: FormattedTerminalResult
  className?: string
}): ReactNode {
  const { t } = useTranslation()

  if (formatted.kind === 'entity') {
    return (
      <div className={cn('min-w-0', className)}>
        <EntityCell result={formatted} />
      </div>
    )
  }
  if (formatted.kind === 'entitysel') {
    return (
      <div className={cn('min-w-0', className)}>
        <SelectionCell result={formatted} />
      </div>
    )
  }
  if (formatted.kind === 'binary') {
    return (
      <div className={cn('min-w-0', className)}>
        <BinaryCell value={formatted.value} />
      </div>
    )
  }
  if (formatted.kind === 'image') {
    return (
      <div className={cn('min-w-0', className)}>
        <ImageCell value={formatted.value} />
      </div>
    )
  }
  if (formatted.kind === 'error') {
    return (
      <div
        className={cn(
          'min-w-0 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 font-mono text-[11px] text-destructive',
          className
        )}
        role="alert"
      >
        {t('terminal.errorPrefix')}: {formatted.message}
      </div>
    )
  }
  return (
    <div className={cn('min-w-0', className)}>
      <OtherCell result={formatted} />
    </div>
  )
}
