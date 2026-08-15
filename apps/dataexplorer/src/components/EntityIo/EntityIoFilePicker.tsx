import { Button, cn } from '@4d/ui'
import { FileUp, Upload } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'

export function EntityIoFilePicker({
  accept,
  fileName,
  detail,
  chooseLabel,
  changeLabel,
  dropLabel,
  onFile,
}: {
  accept: string
  fileName: string | null
  detail?: string
  chooseLabel: string
  changeLabel: string
  dropLabel: string
  onFile: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  const applyFile = (file: File | undefined | null) => {
    if (!file) return
    onFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(true)
  }

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragging(false)
    applyFile(event.dataTransfer.files?.[0])
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop zone wraps choose/change controls
    <div
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-sm border border-border/70 border-dashed bg-background/50 p-1.5 transition-colors',
        dragging && 'border-primary bg-primary/5'
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border bg-muted/25 transition-colors',
          dragging && 'border-primary/40 bg-primary/10 text-primary'
        )}
      >
        {fileName && !dragging ? (
          <FileUp className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <Upload
            className={cn('h-4 w-4 text-muted-foreground', dragging && 'text-primary')}
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-xs">
          {dragging ? dropLabel : (fileName ?? chooseLabel)}
        </p>
        {!dragging && detail ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => inputRef.current?.click()}
      >
        {fileName ? changeLabel : chooseLabel}
      </Button>
    </div>
  )
}
