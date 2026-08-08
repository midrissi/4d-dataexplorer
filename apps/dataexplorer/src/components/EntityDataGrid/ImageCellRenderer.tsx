import { Popover, PopoverContent, PopoverTrigger, Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DeferredImage } from '~/components/DeferredImage'
import { getImageUri } from '~/lib/fieldPaths'

/** Image cell renderer — small thumbnail; hover opens a larger preview popover. */
export function ImageCellRenderer(props: ICellRendererParams) {
  const value = props.value
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openPreview = useCallback(() => {
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer])

  const scheduleClosePreview = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 200)
  }, [clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  if (value === null || value === undefined) {
    return <Value.Null />
  }

  if (!getImageUri(value)) {
    return <Value.Null />
  }

  const fieldName = typeof props.colDef?.field === 'string' ? props.colDef.field : 'Image'

  return (
    <div className="flex h-full items-center justify-center">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-zoom-in border-0 bg-transparent p-0"
            onMouseEnter={openPreview}
            onMouseLeave={scheduleClosePreview}
            onFocus={openPreview}
            onBlur={scheduleClosePreview}
            onClick={(e) => {
              e.stopPropagation()
              clearCloseTimer()
              setOpen((v) => !v)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
            aria-label={fieldName}
          >
            <DeferredImage
              value={value}
              alt={fieldName}
              className="h-5 w-5 rounded-full object-cover"
              loading="eager"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="center"
          sideOffset={8}
          className="w-auto max-w-[min(24rem,90vw)] overflow-hidden p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={openPreview}
          onMouseLeave={scheduleClosePreview}
        >
          <DeferredImage
            value={value}
            alt={fieldName}
            className="max-h-[min(20rem,60vh)] max-w-[min(20rem,80vw)] rounded-md object-contain"
            loading="eager"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
