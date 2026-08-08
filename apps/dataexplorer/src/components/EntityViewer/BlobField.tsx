import { Button, cn, Label } from '@4d/ui'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { BinaryObjectViewer } from '~/components/BinaryObjectViewer'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { getDeferredBlobUrl } from '~/lib/entity-viewer/deferred'

export function BlobField({
  attr,
  entity,
  isEditing,
  isReadonly,
  onFieldChange,
}: {
  attr: { name: string; readOnly?: boolean }
  entity: Record<string, unknown>
  isEditing: boolean
  isReadonly: boolean
  onFieldChange: (field: string, value: unknown) => void
}) {
  const { t } = useTranslation()
  const value = entity[attr.name]
  // An existing, unmodified BLOB comes back as a deferred download URI.
  const existingBlobUrl = getDeferredBlobUrl(value)
  const hasUpload = (value && typeof value === 'object' && 'ID' in value) || existingBlobUrl != null
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldId = `field-${attr.name}`

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file || !isEditing || isReadonly) return
      setUploading(true)
      try {
        const result = await api.uploadFile(file, false)
        onFieldChange(attr.name, { ID: result.ID })
        setFileName(file.name)
      } catch (err) {
        alert(err instanceof Error ? err.message : t('entity.failedToUploadFile'))
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [attr.name, isEditing, isReadonly, onFieldChange, t]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFileUpload(file)
    },
    [handleFileUpload]
  )

  const handleRemove = useCallback(() => {
    if (isReadonly) return
    onFieldChange(attr.name, null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [attr.name, isReadonly, onFieldChange])

  const [isDragging, setIsDragging] = useState(false)
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    },
    [isEditing, isReadonly]
  )
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
    },
    [isEditing, isReadonly]
  )
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFileUpload(file)
    },
    [isEditing, isReadonly, handleFileUpload]
  )

  return (
    <div className="grid grid-cols-[minmax(180px,auto)_1fr] items-start gap-3">
      <Label htmlFor={fieldId} className="flex items-center gap-1.5 pt-2 text-sm">
        <span>{attr.name}</span>
      </Label>
      <div>
        {existingBlobUrl && !fileName && !isEditing ? (
          <BinaryObjectViewer url={existingBlobUrl} name={attr.name} />
        ) : (
          <section
            className={cn(
              'flex flex-col items-center justify-center rounded-md border-2 border-muted-foreground/25 border-dashed p-4 transition-colors',
              isDragging && 'border-primary bg-primary/5',
              isEditing && !isReadonly && 'cursor-pointer hover:border-primary/50'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => {
              if (isEditing && !isReadonly && !uploading) fileInputRef.current?.click()
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isEditing && !isReadonly && !uploading) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            role={isEditing && !isReadonly ? 'button' : undefined}
            tabIndex={isEditing && !isReadonly ? 0 : undefined}
            aria-label={t('entity.fileDropZoneAria')}
          >
            {hasUpload || fileName ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {fileName ?? t('entity.fileUploaded')}
                </p>
                {existingBlobUrl && !fileName && (
                  <a
                    href={existingBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs transition-colors hover:bg-muted"
                    title={t('common.openInNewTab')}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t('entity.downloadBlob')}
                  </a>
                )}
                {isEditing && !isReadonly && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="h-6 gap-1 px-2 text-xs"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('entity.uploading')}
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          {t('entity.replace')}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove()
                      }}
                      disabled={uploading}
                      className="h-6 gap-1 px-2 text-destructive text-xs"
                    >
                      <X className="h-3 w-3" />
                      {t('common.remove')}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-2 text-muted-foreground text-sm">
                  {isDragging ? t('entity.dropFileHere') : t('entity.noFile')}
                </p>
                {isEditing && !isReadonly && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="h-6 gap-1 px-2 text-xs"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('entity.uploading')}
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          {t('entity.uploadFile')}
                        </>
                      )}
                    </Button>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {t('entity.orDragAndDropHere')}
                    </p>
                  </>
                )}
              </>
            )}
          </section>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isReadonly || !isEditing}
        />
      </div>
    </div>
  )
}
