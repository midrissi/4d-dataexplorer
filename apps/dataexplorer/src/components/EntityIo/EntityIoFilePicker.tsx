import { Button } from '@4d/ui'
import { FileUp, Upload } from 'lucide-react'
import { useRef } from 'react'

export function EntityIoFilePicker({
  accept,
  fileName,
  detail,
  chooseLabel,
  changeLabel,
  onFile,
}: {
  accept: string
  fileName: string | null
  detail?: string
  chooseLabel: string
  changeLabel: string
  onFile: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex min-h-11 items-center gap-2 rounded-sm border border-border/70 bg-background/50 p-1.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border bg-muted/25">
        {fileName ? (
          <FileUp className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-xs">{fileName ?? chooseLabel}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
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
