import { Button, cn, Label, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { Calculator, Image as ImageIcon, Loader2, Lock, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DownloadableImage } from '~/components/DownloadableImage'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { getImageUri } from '~/lib/fieldPaths'

export function ImageField({
  attr,
  entity,
  isEditing,
  isReadonly,
  onFieldChange,
}: {
  attr: { name: string; readOnly?: boolean; kind?: string }
  entity: Record<string, unknown>
  dataclassName: string | null
  entityId: string | null
  isEditing: boolean
  isReadonly: boolean
  onFieldChange: (field: string, value: unknown) => void
}) {
  const { t } = useTranslation()
  const imageUrl = getImageUri(entity[attr.name])
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldId = `field-${attr.name}`

  // Set preview URL when value changes
  useEffect(() => {
    if (imageUrl) {
      setPreviewUrl(imageUrl)
    } else {
      setPreviewUrl(null)
    }
  }, [imageUrl])

  // Validate file type (images and PDFs)
  const isValidFileType = useCallback((file: File): boolean => {
    return file.type.startsWith('image/') || file.type === 'application/pdf'
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file || !isEditing || isReadonly) return

      // Validate file type
      if (!isValidFileType(file)) {
        alert(t('entity.selectImageOrPdf'))
        return
      }

      setUploading(true)
      try {
        // Create preview for images only
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setPreviewUrl(reader.result as string)
          }
          reader.readAsDataURL(file)
        } else if (file.type === 'application/pdf') {
          // For PDFs, show a placeholder or icon
          setPreviewUrl(null)
        }

        // Upload file (use $rawPict=true for images, $binary=true for PDFs)
        const isImage = file.type.startsWith('image/')
        const result = await api.uploadFile(file, isImage)
        // Store upload ID in form data
        onFieldChange(attr.name, { ID: result.ID })
      } catch (err) {
        alert(err instanceof Error ? err.message : t('entity.failedToUploadFile'))
        setPreviewUrl(imageUrl || null)
      } finally {
        setUploading(false)
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [attr.name, isEditing, isReadonly, imageUrl, onFieldChange, isValidFileType, t]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await handleFileUpload(file)
      }
    },
    [handleFileUpload]
  )

  const handleRemoveImage = useCallback(() => {
    if (isReadonly) return
    setPreviewUrl(null)
    onFieldChange(attr.name, null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [attr.name, isReadonly, onFieldChange])

  // Drag and drop handlers
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
      if (file) {
        await handleFileUpload(file)
      }
    },
    [isEditing, isReadonly, handleFileUpload]
  )

  return (
    <div className="grid grid-cols-[minmax(180px,auto)_1fr] items-start gap-3">
      <Label htmlFor={fieldId} className="flex items-center gap-1.5 pt-2 text-sm">
        <span>{attr.name}</span>
        <div className="flex items-center gap-1">
          {attr.readOnly && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t('entity.readOnlyField')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {attr.kind && attr.kind === 'calculated' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Calculator className="h-3 w-3 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t('entity.computedField')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </Label>
      <div>
        {previewUrl ? (
          <section
            className={cn(
              'relative inline-block rounded-md transition-colors',
              isDragging && 'ring-2 ring-primary ring-offset-2'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            aria-label={t('entity.imageDropZoneAria')}
          >
            <DownloadableImage
              src={previewUrl}
              alt={attr.name}
              name={attr.name}
              imgClassName="max-h-48 max-w-full rounded-md object-contain"
            />
            {isEditing && !isReadonly ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-8 gap-1 px-2 text-xs"
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
                  onClick={handleRemoveImage}
                  disabled={uploading}
                  className="h-8 gap-1 px-2 text-destructive text-xs"
                >
                  <X className="h-3 w-3" />
                  {t('common.remove')}
                </Button>
              </div>
            ) : null}
          </section>
        ) : (
          <section
            className={cn(
              'rounded-lg transition-colors',
              isDragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              isEditing && !isReadonly && 'cursor-pointer'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => {
              if (isEditing && !isReadonly && !uploading) {
                fileInputRef.current?.click()
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isEditing && !isReadonly && !uploading) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            role={isEditing && !isReadonly ? 'button' : undefined}
            tabIndex={isEditing && !isReadonly ? 0 : undefined}
            aria-label={t('entity.imageDropZoneAria')}
          >
            <EmptyPanel
              icon={ImageIcon}
              badgeIcon={isEditing && !isReadonly ? Upload : undefined}
              badgeTone="primary"
              title={isDragging ? t('entity.dropImageOrPdfHere') : t('entity.noImage')}
              description={
                isEditing && !isReadonly
                  ? t('entity.orDragAndDropHere')
                  : t('entity.noImageDescription')
              }
              ghost="rows"
              bordered
              size="sm"
              className="min-h-36 w-full"
              action={
                isEditing && !isReadonly ? (
                  <EmptyPanelAction
                    icon={uploading ? Loader2 : Upload}
                    disabled={uploading}
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    {uploading ? t('entity.uploading') : t('entity.uploadImageOrPdf')}
                  </EmptyPanelAction>
                ) : undefined
              }
            />
          </section>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isReadonly || !isEditing}
        />
      </div>
    </div>
  )
}
