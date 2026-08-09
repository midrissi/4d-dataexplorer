import { cn } from '@4d/ui'
import { Play } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TabOverviewDetails } from '~/lib/tab-overview-details'
import {
  isAssistantMetadataTab,
  isDataclassTab,
  isGraphTab,
  isHomeTab,
  isHttpClientTab,
  isMethodExecutorTab,
  isRestExportBuilderTab,
  isSchemaBuilderTab,
  isSettingsTab,
  type Tab,
} from '~/store/tabs'

type MobileTabOverviewPreviewProps = {
  tab: Tab
  isActive: boolean
  details: TabOverviewDetails
  iconTone: string
  renderTabIcon: (tab: Tab, className: string) => ReactNode
}

function SkeletonBar({ className, active }: { className?: string; active?: boolean }) {
  return (
    <div
      className={cn('h-1.5 rounded-full', active ? 'bg-primary/20' : 'bg-foreground/10', className)}
    />
  )
}

function PreviewChrome({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={cn(
        'flex w-full shrink-0 items-center gap-1 border-b px-2.5 py-1.5',
        isActive ? 'border-primary/15 bg-background' : 'border-border/60 bg-background'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
      <span className="ml-1.5 h-1.5 min-w-0 flex-1 rounded-full bg-muted-foreground/15" />
    </div>
  )
}

function DataclassPreview({ isActive, chips }: { isActive: boolean; chips: string[] }) {
  const rows = [
    { id: 'r1', w: ['w-[18%]', 'w-[42%]', 'w-[22%]'] },
    { id: 'r2', w: ['w-[14%]', 'w-[50%]', 'w-[18%]'] },
    { id: 'r3', w: ['w-[20%]', 'w-[36%]', 'w-[26%]'] },
    { id: 'r4', w: ['w-[16%]', 'w-[44%]', 'w-[20%]'] },
  ]

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          'grid w-full shrink-0 grid-cols-[0.8fr_1.6fr_0.9fr] gap-1 border-b px-2.5 py-1.5',
          isActive ? 'border-primary/15 bg-background' : 'border-border/50 bg-background'
        )}
      >
        {(['#', '···', '··'] as const).map((label) => (
          <span
            key={label}
            className="truncate font-medium text-[8px] text-muted-foreground/80 tracking-wide"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              'grid w-full shrink-0 grid-cols-[0.8fr_1.6fr_0.9fr] items-center gap-1 border-border/40 border-b px-2.5 py-1.5 last:border-b-0',
              isActive ? 'bg-background/80' : 'bg-card/60'
            )}
          >
            {row.w.map((width) => (
              <SkeletonBar key={width} active={isActive} className={width} />
            ))}
          </div>
        ))}
      </div>
      {chips.length > 0 ? (
        <div className="flex w-full shrink-0 flex-wrap gap-1 border-border/50 border-t px-2.5 py-1.5">
          {chips.slice(0, 3).map((chip) => (
            <span
              key={chip}
              className={cn(
                'max-w-full truncate rounded-md px-1.5 py-0.5 font-medium text-[9px]',
                isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function HttpPreview({
  isActive,
  method,
  path,
}: {
  isActive: boolean
  method: string
  path: string
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          'flex w-full shrink-0 items-center gap-1.5 border-b px-2.5 py-2',
          isActive ? 'border-primary/15 bg-background' : 'border-border/50 bg-background'
        )}
      >
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 font-bold font-mono text-[9px] tracking-wide',
            isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          {method}
        </span>
        <span className="min-w-0 truncate font-mono text-[9px] text-muted-foreground">{path}</span>
      </div>
      <div className="w-full shrink-0 space-y-1.5 border-border/50 border-b bg-background px-2.5 py-2">
        <SkeletonBar active={isActive} className="w-1/3" />
        <SkeletonBar active={isActive} className="w-4/5" />
        <SkeletonBar active={isActive} className="w-2/3" />
      </div>
      <div className="min-h-0 w-full flex-1 space-y-1.5 overflow-hidden bg-background px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <SkeletonBar active={isActive} className="w-1/4" />
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono font-semibold text-[9px]',
              isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            200
          </span>
        </div>
        <SkeletonBar active={isActive} className="w-full" />
        <SkeletonBar active={isActive} className="w-3/5" />
      </div>
    </div>
  )
}

function MethodPreview({ isActive, icon }: { isActive: boolean; icon: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex w-full shrink-0 items-center gap-2 border-border/50 border-b px-2.5 py-2.5">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            isActive ? 'bg-primary/15' : 'bg-background'
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <SkeletonBar active={isActive} className="w-4/5" />
          <SkeletonBar active={isActive} className="w-2/5" />
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {(['arg-a', 'arg-b', 'arg-c'] as const).map((argId) => (
          <div
            key={argId}
            className={cn(
              'flex w-full shrink-0 items-center gap-2 border-border/40 border-b px-2.5 py-1.5 last:border-b-0',
              isActive ? 'bg-background/80' : 'bg-card/60'
            )}
          >
            <SkeletonBar active={isActive} className="w-1/4" />
            <SkeletonBar active={isActive} className="w-1/2" />
          </div>
        ))}
      </div>
      <div
        className={cn(
          'flex h-8 w-full shrink-0 items-center justify-center border-border/50 border-t',
          isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        <Play className="h-3 w-3 fill-current" aria-hidden />
      </div>
    </div>
  )
}

function ListPreview({
  isActive,
  icon,
  rows = 5,
}: {
  isActive: boolean
  icon: ReactNode
  rows?: number
}) {
  const rowIds = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, rows)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex w-full shrink-0 items-center gap-2 border-border/50 border-b px-2.5 py-2.5">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            isActive ? 'bg-primary/15' : 'bg-background'
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <SkeletonBar active={isActive} className="w-3/5" />
          <SkeletonBar active={isActive} className="w-2/5" />
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {rowIds.map((rowId, index) => (
          <div
            key={rowId}
            className={cn(
              'flex w-full shrink-0 items-center gap-2 border-border/40 border-b px-2.5 py-1.5 last:border-b-0',
              isActive ? 'bg-background/80' : 'bg-card/60'
            )}
          >
            <span
              className={cn(
                'h-4 w-4 shrink-0 rounded-md',
                isActive ? 'bg-primary/15' : 'bg-foreground/8'
              )}
            />
            <SkeletonBar active={isActive} className={index % 2 === 0 ? 'w-3/5' : 'w-4/5'} />
          </div>
        ))}
      </div>
    </div>
  )
}

function GraphPreview({ isActive }: { isActive: boolean }) {
  const nodes = [
    { id: 'n1', top: '14%', left: '22%' },
    { id: 'n2', top: '20%', left: '68%' },
    { id: 'n3', top: '48%', left: '44%' },
    { id: 'n4', top: '72%', left: '20%' },
    { id: 'n5', top: '74%', left: '70%' },
  ]
  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div
        className={cn(
          'absolute top-[22%] left-[30%] h-px w-[28%] origin-left rotate-[38deg]',
          isActive ? 'bg-primary/25' : 'bg-muted-foreground/25'
        )}
      />
      <div
        className={cn(
          'absolute top-[28%] right-[28%] h-px w-[26%] origin-right -rotate-[42deg]',
          isActive ? 'bg-primary/25' : 'bg-muted-foreground/25'
        )}
      />
      <div
        className={cn(
          'absolute bottom-[30%] left-[28%] h-px w-[24%] origin-left rotate-[48deg]',
          isActive ? 'bg-primary/25' : 'bg-muted-foreground/25'
        )}
      />
      <div
        className={cn(
          'absolute right-[26%] bottom-[28%] h-px w-[24%] origin-right -rotate-[44deg]',
          isActive ? 'bg-primary/25' : 'bg-muted-foreground/25'
        )}
      />
      {nodes.map((node) => (
        <span
          key={node.id}
          className={cn(
            'absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-xs',
            isActive ? 'border-primary/40 bg-primary/20' : 'border-border bg-background'
          )}
          style={{ top: node.top, left: node.left }}
        />
      ))}
    </div>
  )
}

export function MobileTabOverviewPreview({
  tab,
  isActive,
  details,
  iconTone,
  renderTabIcon,
}: MobileTabOverviewPreviewProps) {
  const icon = renderTabIcon(tab, cn('h-5 w-5', iconTone))

  let body: ReactNode
  if (isDataclassTab(tab)) {
    body = <DataclassPreview isActive={isActive} chips={details.chips} />
  } else if (isHttpClientTab(tab)) {
    const method =
      tab.seed?.method === 'CUSTOM' ? tab.seed.customMethod || 'CUSTOM' : tab.seed?.method || 'GET'
    const path = tab.seed?.path?.split('?')[0] || '/'
    body = <HttpPreview isActive={isActive} method={method} path={path} />
  } else if (isMethodExecutorTab(tab)) {
    body = <MethodPreview isActive={isActive} icon={icon} />
  } else if (isGraphTab(tab)) {
    body = <GraphPreview isActive={isActive} />
  } else if (
    isHomeTab(tab) ||
    isSettingsTab(tab) ||
    isSchemaBuilderTab(tab) ||
    isAssistantMetadataTab(tab) ||
    isRestExportBuilderTab(tab)
  ) {
    body = <ListPreview isActive={isActive} icon={icon} rows={isHomeTab(tab) ? 4 : 5} />
  } else {
    body = <ListPreview isActive={isActive} icon={icon} rows={4} />
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" aria-hidden>
      <PreviewChrome isActive={isActive} />
      {body}
    </div>
  )
}
