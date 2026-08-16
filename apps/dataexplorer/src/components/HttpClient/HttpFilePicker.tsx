import { Button, cn } from '@4d/ui'
import { FileUp, Paperclip, X } from 'lucide-react'
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { subscribeDesktopFileDragState, subscribeDesktopFileDrop } from '~/lib/desktop-file-drop'
import { formatByteSize } from '~/lib/http-client'

function fileExtensionTone(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
    return 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300'
  }
  if (['json', 'xml', 'yml', 'yaml', 'toml'].includes(ext)) {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  }
  if (['js', 'ts', 'tsx', 'jsx', 'css', 'html'].includes(ext)) {
    return 'bg-sky-500/15 text-sky-800 dark:text-sky-300'
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
    return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
  }
  if (['zip', 'gz', 'tar', 'rar', '7z'].includes(ext)) {
    return 'bg-orange-500/15 text-orange-800 dark:text-orange-300'
  }
  return 'bg-muted text-muted-foreground'
}

function extensionLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase()
  if (!ext || ext === fileName.toUpperCase() || ext.length > 5) return 'FILE'
  return ext
}

function contentTypeFromFileName(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    csv: 'text/csv',
    gif: 'image/gif',
    html: 'text/html',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    json: 'application/json',
    pdf: 'application/pdf',
    png: 'image/png',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    webp: 'image/webp',
    xml: 'application/xml',
    zip: 'application/zip',
  }
  return ext ? types[ext] : undefined
}

export function HttpFilePicker({
  fileName,
  contentType,
  fileSize,
  onPick,
  onClear,
  variant = 'inline',
  className,
  accept,
}: {
  fileName?: string
  contentType?: string
  fileSize?: number
  onPick: (file: File) => void
  onClear?: () => void
  variant?: 'inline' | 'panel'
  className?: string
  accept?: string
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const hasFile = Boolean(fileName)
  const selectedName = fileName ?? ''
  const selectedExt = extensionLabel(selectedName)
  const selectedTone = fileExtensionTone(selectedName)

  const openPicker = () => {
    inputRef.current?.click()
  }

  const applyFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return
      onPick(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [onPick]
  )

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyFile(event.target.files?.[0])
  }

  useEffect(
    () =>
      subscribeDesktopFileDrop((dropped) => {
        const bytes = Uint8Array.from(dropped.bytes)
        applyFile(
          new File([bytes], dropped.name, {
            type: dropped.type || contentTypeFromFileName(dropped.name),
          })
        )
      }),
    [applyFile]
  )

  useEffect(() => subscribeDesktopFileDragState(setDragging), [])

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setDragging(false)
    applyFile(event.dataTransfer.files?.[0])
  }

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    dragDepthRef.current += 1
    setDragging(true)
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragging(false)
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      onChange={onInputChange}
    />
  )

  if (variant === 'panel') {
    return (
      <div className={cn('space-y-2', className)}>
        {hiddenInput}
        {hasFile ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: drop target wraps replace/clear controls
          <div
            className={cn(
              'flex items-center gap-3 rounded-md border bg-muted/25 px-3 py-2.5 transition-colors',
              dragging && 'border-primary bg-primary/5'
            )}
            onDrop={onDrop}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-semibold text-[10px] tracking-wide',
                selectedTone
              )}
              aria-hidden
            >
              {selectedExt}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium font-mono text-sm">{selectedName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {[fileSize !== undefined ? formatByteSize(fileSize) : null, contentType || null]
                  .filter(Boolean)
                  .join(' · ') || t('httpClient.fileReady')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={openPicker}
              >
                {t('httpClient.replaceFile')}
              </Button>
              {onClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={onClear}
                  aria-label={t('httpClient.clearFile')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            onDrop={onDrop}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors',
              'hover:border-primary/40 hover:bg-muted/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              dragging && 'border-primary bg-primary/5'
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform',
                dragging && 'scale-105'
              )}
            >
              <FileUp className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <p className="font-medium text-sm">
                {dragging ? t('httpClient.dropFileHere') : t('httpClient.chooseBinaryTitle')}
              </p>
              <p className="max-w-xs text-muted-foreground text-xs">
                {dragging ? t('httpClient.dropFileHere') : t('httpClient.dropOrChooseFile')}
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 font-medium text-[11px] shadow-sm">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              {t('httpClient.chooseFile')}
            </span>
          </button>
        )}
      </div>
    )
  }

  if (hasFile) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: drop target wraps replace/clear controls
      <div
        className={cn(
          'relative flex h-8 min-w-0 items-center gap-1.5 px-1.5',
          dragging && 'bg-primary/5',
          className
        )}
        onDrop={onDrop}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {hiddenInput}
        <button
          type="button"
          onClick={openPicker}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-0.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t('httpClient.replaceFile')}
        >
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded font-semibold text-[8px] tracking-wide',
              selectedTone
            )}
            aria-hidden
          >
            {selectedExt.slice(0, 3)}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
            {selectedName}
          </span>
          {fileSize !== undefined ? (
            <span className="shrink-0 rounded bg-muted/80 px-1 py-px text-[9px] text-muted-foreground tabular-nums">
              {formatByteSize(fileSize)}
            </span>
          ) : null}
        </button>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onClear}
            aria-label={t('httpClient.clearFile')}
          >
            <X className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        'relative flex h-8 w-full min-w-0 items-center gap-1.5 px-2 text-left transition-colors',
        'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'bg-primary/5 text-foreground',
        className
      )}
    >
      {hiddenInput}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border/80 border-dashed bg-muted/40">
        <Paperclip className="h-3 w-3" />
      </span>
      <span className="truncate text-[11px]">
        {dragging ? t('httpClient.dropFileHere') : t('httpClient.chooseFile')}
      </span>
    </button>
  )
}
