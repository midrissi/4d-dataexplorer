import { ClickToCopy, cn } from '@4d/ui'
import { Database, FileArchive, FileText, FolderOpen } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { FileOrFolderDecoded } from './types'

interface PathBinaryViewProps {
  data: FileOrFolderDecoded
  kind: 'file' | 'folder'
  className?: string
}

function splitPath(path: string): string[] {
  return path.split(/[/\\]+/).filter(Boolean)
}

export function FileBinaryView({ data, className }: Omit<PathBinaryViewProps, 'kind'>) {
  return <PathBinaryView data={data} kind="file" className={className} />
}

export function FolderBinaryView({ data, className }: Omit<PathBinaryViewProps, 'kind'>) {
  return <PathBinaryView data={data} kind="folder" className={className} />
}

function PathBinaryView({ data, kind, className }: PathBinaryViewProps) {
  const { t } = useTranslation()
  const segments = splitPath(data.path)
  const leaf = segments.at(-1) ?? data.path
  const isZip = data.type === 'ZIP_FILE'
  const typeLabel =
    data.type === 'CLASSIC_FILE'
      ? t('entity.binaryFileClassic')
      : data.type === 'ZIP_FILE'
        ? t('entity.binaryFileZip')
        : data.type

  const Icon = kind === 'folder' ? FolderOpen : isZip ? FileArchive : FileText
  const accent =
    kind === 'folder'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
      : isZip
        ? 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200'
  const iconTile =
    kind === 'folder'
      ? 'border-amber-500/30 text-amber-700 dark:text-amber-300'
      : isZip
        ? 'border-violet-500/30 text-violet-700 dark:text-violet-300'
        : 'border-sky-500/30 text-sky-700 dark:text-sky-300'

  return (
    <div className={cn('overflow-hidden rounded-md border bg-muted/20 text-xs', className)}>
      <div className="flex items-start gap-2 border-b bg-muted/30 p-2">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background',
            iconTile
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-xs">{data.name}</span>
            <span
              className={cn(
                'rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
                accent
              )}
            >
              {typeLabel}
            </span>
          </div>
          <p className="truncate font-medium text-[11px]" title={leaf}>
            {leaf || t('entity.binaryPathEmpty')}
          </p>
        </div>
        <ClickToCopy
          value={data.path}
          tooltipLabel={t('entity.binaryPathCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border bg-background px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {t('entity.binaryPathCopyShort')}
        </ClickToCopy>
      </div>

      <div className="space-y-2.5 p-2">
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {t('entity.binaryPath')}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background/70 p-1.5 font-mono text-[11px]">
            {data.path.startsWith('/') || data.path.startsWith('\\') ? (
              <span className="text-muted-foreground">/</span>
            ) : null}
            {segments.length === 0 ? (
              <span className="text-muted-foreground">{t('entity.binaryPathEmpty')}</span>
            ) : (
              segments.map((segment, index) => {
                const pathKey = segments.slice(0, index + 1).join('/')
                return (
                  <span key={pathKey} className="inline-flex items-center gap-1">
                    {index > 0 ? <span className="text-muted-foreground/70">/</span> : null}
                    <span
                      className={cn(
                        'rounded px-1 py-0.5',
                        index === segments.length - 1
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {segment}
                    </span>
                  </span>
                )
              })
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-0.5 rounded-md border bg-background/60 px-2 py-1.5">
            <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t('entity.binaryFileType')}
            </dt>
            <dd className="font-mono text-[11px]">{data.type}</dd>
          </div>
          <div className="space-y-0.5 rounded-md border bg-background/60 px-2 py-1.5">
            <dt className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Database className="h-3 w-3" />
              {t('entity.binaryDatabaseId')}
            </dt>
            <dd className="truncate font-mono text-[11px]" title={data.databaseId || undefined}>
              {data.databaseId || t('entity.binaryDatabaseIdEmpty')}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
