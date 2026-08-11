import { Button, cn, Input, Label, ScrollArea, TemplatedTextInput } from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import { Loader2, Upload, X } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BinaryObjectViewer,
  isPrivateBinaryObject,
  PRIVATE_BINARY_OBJECT_KEY,
} from '~/components/BinaryObjectViewer'
import { EntityFormValueOrTemplateField } from '~/components/EntityFormValueOrTemplateField'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { useEditorLabels, useTranslation } from '~/i18n'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'

// Object attribute field: JSON code editor, syncs with form data when valid
function EntityFormObjectField({
  attr,
  fieldValue,
  onFieldChange,
  fieldIdPrefix,
}: {
  attr: SchemaAttr
  fieldValue: unknown
  onFieldChange: (field: string, value: unknown) => void
  fieldIdPrefix: string
}) {
  const { t } = useTranslation()
  const editorLabels = useEditorLabels()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const fieldId = `${fieldIdPrefix}-${attr.name}`
  const valueObj =
    fieldValue !== null && typeof fieldValue === 'object' && !Array.isArray(fieldValue)
      ? fieldValue
      : {}

  const [rawString, setRawString] = useState(() => JSON.stringify(valueObj, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)
  const lastPushedValueRef = useRef<object | null>(null)

  // Sync from parent only when field value is replaced from outside (e.g. new entity loaded).
  // Skip when the update came from our own handleChange so we don't overwrite user typing.
  useEffect(() => {
    const v =
      fieldValue !== null && typeof fieldValue === 'object' && !Array.isArray(fieldValue)
        ? fieldValue
        : {}
    if (v === lastPushedValueRef.current) return
    lastPushedValueRef.current = v
    setRawString(JSON.stringify(v, null, 2))
    setParseError(null)
  }, [fieldValue])

  const handleChange = useCallback(
    (value: string) => {
      setRawString(value)
      try {
        const parsed = JSON.parse(value || '{}')
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setParseError(t('entity.valueMustBeJsonObject'))
          return
        }
        setParseError(null)
        lastPushedValueRef.current = parsed
        onFieldChange(attr.name, parsed)
      } catch {
        setParseError(t('entity.invalidJson'))
      }
    },
    [attr.name, onFieldChange, t]
  )

  // 4D private binary object: not editable as JSON — show the dedicated viewer.
  if (isPrivateBinaryObject(fieldValue)) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId} className="text-sm">
          {attr.name}
        </Label>
        <div id={fieldId}>
          <BinaryObjectViewer base64={fieldValue[PRIVATE_BINARY_OBJECT_KEY]} name={attr.name} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm">
        {attr.name}
      </Label>
      <div id={fieldId} className="rounded-md">
        <CodeEditor
          value={rawString}
          onChange={handleChange}
          language="json"
          height="160px"
          showLineNumbers
          highlightActiveLine
          error={!!parseError}
          toolbar
          labels={editorLabels}
          editorPrefs={codeEditorPrefs}
          onEditorPrefsChange={updateCodeEditorPrefs}
        />
      </div>
      {parseError && (
        <p className="text-destructive text-xs" role="alert">
          {parseError}
        </p>
      )}
    </div>
  )
}

function EntityFormDurationField({
  attr,
  fieldValue,
  onFieldChange,
  fieldIdPrefix,
}: {
  attr: SchemaAttr
  fieldValue: unknown
  onFieldChange: (field: string, value: number | null) => void
  fieldIdPrefix: string
}) {
  const { t } = useTranslation()
  const fieldId = `${fieldIdPrefix}-${attr.name}`
  const formatted = durationValueToInputValue(fieldValue)
  const [rawString, setRawString] = useState(formatted)
  const lastPushedRef = useRef<number | null>(null)

  useEffect(() => {
    const same =
      (fieldValue == null && lastPushedRef.current == null) ||
      (typeof fieldValue === 'number' && fieldValue === lastPushedRef.current)
    if (same) return
    lastPushedRef.current =
      typeof fieldValue === 'number' && !Number.isNaN(fieldValue) ? fieldValue : null
    setRawString(durationValueToInputValue(fieldValue))
  }, [fieldValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setRawString(next)
    const parsed = parseDurationInput(next)
    if (parsed !== null) {
      lastPushedRef.current = parsed
      onFieldChange(attr.name, parsed)
      // Do not setRawString(formatted) here: it overwrites the user's input while typing
      // (e.g. "1h" → "01:00:00" prevents typing "1h 30m"). Sync from props happens in useEffect.
    } else {
      lastPushedRef.current = null
      onFieldChange(attr.name, null)
    }
  }

  const handleBlur = () => {
    // Normalize display to HH:MM:SS on blur so it matches the saved value
    setRawString(durationValueToInputValue(fieldValue))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm">
        {attr.name}
      </Label>
      <Input
        id={fieldId}
        type="text"
        value={rawString}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={t('entity.durationPlaceholder')}
      />
    </div>
  )
}

import { ErrorList } from '~/components/ErrorList'
import { api } from '~/lib/api'
import { durationValueToInputValue, parseDurationInput } from '~/lib/duration'
import { isNumberAttrType, prepareEntityFormData } from '~/lib/env/coerce-entity-data'

export type EntityFormMode = 'create' | 'edit'

export type SchemaAttr = {
  name: string
  type: string
  kind: string
  readOnly?: boolean
  autosequence?: boolean
}

function getDisplayableAttributes(
  schema: { key: string | undefined; attributes: SchemaAttr[] } | null,
  mode: EntityFormMode
): SchemaAttr[] {
  if (!schema) return []
  const systemFields = new Set(['__TIMESTAMP', '__KEY', '__STAMP', '__DATACLASS'])
  const primaryKey = schema.key
  return schema.attributes.filter((attr) => {
    if (systemFields.has(attr.name)) return false
    // Show primary key only when creating; hide when editing (cannot change)
    if (mode === 'edit' && attr.name === primaryKey) return false
    if (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities') return false
    if (attr.readOnly) return false
    return true
  })
}

// Upload field for image/blob attributes (works for create and edit)
function EntityFormUploadField({
  attr,
  fieldValue,
  onFieldChange,
  fieldIdPrefix,
}: {
  attr: SchemaAttr
  fieldValue: unknown
  onFieldChange: (field: string, value: unknown) => void
  fieldIdPrefix: string
}) {
  const { t } = useTranslation()
  const isImage = attr.type === 'image'
  const hasUpload = fieldValue && typeof fieldValue === 'object' && 'ID' in fieldValue
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldId = `${fieldIdPrefix}-${attr.name}`

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const isImageFile =
          isImage && (file.type.startsWith('image/') || file.type === 'application/pdf')
        const result = await api.uploadFile(file, isImageFile)
        onFieldChange(attr.name, { ID: result.ID })
        setFileName(file.name)
      } catch (err) {
        alert(err instanceof Error ? err.message : t('entity.failedToUploadFile'))
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [attr.name, isImage, onFieldChange, t]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFileUpload(file)
    },
    [handleFileUpload]
  )

  const handleRemove = useCallback(() => {
    onFieldChange(attr.name, null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [attr.name, onFieldChange])

  const [isDragging, setIsDragging] = useState(false)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFileUpload(file)
    },
    [handleFileUpload]
  )

  const dropLabel = isImage ? t('entity.dropImageOrPdfHere') : t('entity.dropFileHere')
  const uploadLabel = isImage ? t('entity.uploadImageOrPdf') : t('entity.uploadFile')

  return (
    <div key={attr.name} className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm">
        {attr.name}
      </Label>
      <section
        className={cn(
          'flex flex-col items-center justify-center rounded-md border-2 border-muted-foreground/25 border-dashed p-4 transition-colors',
          isDragging && 'border-primary bg-primary/5',
          'cursor-pointer hover:border-primary/50'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        aria-label={t('entity.fileDropZoneAria')}
      >
        {hasUpload || fileName ? (
          <>
            <span className="text-muted-foreground text-sm">
              {fileName ?? t('entity.fileUploaded')}
            </span>
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
                className="h-6 gap-1 px-2 text-destructive text-xs hover:text-destructive"
              >
                <X className="h-3 w-3" />
                {t('common.remove')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="mb-2 text-muted-foreground text-sm">
              {isDragging ? dropLabel : t('entity.noFile')}
            </p>
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
                  {uploadLabel}
                </>
              )}
            </Button>
            <p className="mt-2 text-muted-foreground text-xs">{t('entity.orDragAndDropHere')}</p>
          </>
        )}
      </section>
      <input
        ref={fileInputRef}
        type="file"
        accept={isImage ? 'image/*,.pdf' : undefined}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

export interface EntityFormProps {
  dataclassName: string
  initialData: Record<string, unknown>
  mode: EntityFormMode
  /** For edit mode: entity ID (e.g. for file upload context). Optional for create. */
  entityId?: string | null
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  /** Scroll height for form area (e.g. "300px"). Default "300px". */
  scrollHeight?: string
  /** Prefix for field ids (for a11y). Default "entity-form". */
  fieldIdPrefix?: string
  /** Called when submit starts or finishes so parent can show loading state. */
  onSubmittingChange?: (submitting: boolean) => void
  /** Called when canSubmit changes (e.g. form has no fields in form mode). */
  onCanSubmitChange?: (canSubmit: boolean) => void
  /** When true, focus the first non-autosequence field once the form has fields (e.g. when modal opens). */
  autoFocusFirstField?: boolean
  /** When false, do not render inline error (e.g. when parent shows error in a banner). Default true. */
  showError?: boolean
}

export interface EntityFormHandle {
  submit: () => Promise<void>
  getFormData: () => Record<string, unknown>
  /** Focus the first focusable field (input, textarea, select, or checkbox). */
  focusFirstField: () => void
}

export const EntityForm = forwardRef<EntityFormHandle, EntityFormProps>(function EntityForm(
  {
    dataclassName,
    initialData,
    mode,
    entityId: _entityId,
    onSubmit,
    scrollHeight = '300px',
    fieldIdPrefix = 'entity-form',
    onSubmittingChange,
    onCanSubmitChange,
    autoFocusFirstField = false,
    showError = true,
  },
  ref
) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  const envField = useTemplatedEnvFieldProps({ thisRoot: formData })
  const [schema, setSchema] = useState<Awaited<ReturnType<typeof api.getDataclassSchema>> | null>(
    null
  )
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const hasAutoFocusedRef = useRef(false)

  // Sync from initialData when it changes (e.g. dialog opened with new data)
  const [dataVersion, setDataVersion] = useState(0)
  useEffect(() => {
    setFormData(initialData)
    setError(null)
    setDataVersion((version) => version + 1)
  }, [initialData])

  useEffect(() => {
    if (!dataclassName) {
      setSchema(null)
      return
    }
    setSchemaLoading(true)
    api
      .getDataclassSchema(dataclassName)
      .then((s) => {
        setSchema(s)
        setSchemaLoading(false)
      })
      .catch(() => {
        setSchema(null)
        setSchemaLoading(false)
      })
  }, [dataclassName])

  const displayableAttributes = useMemo(
    () => getDisplayableAttributes(schema, mode),
    [schema, mode]
  )

  const canSubmit = displayableAttributes.length > 0
  useEffect(() => {
    onCanSubmitChange?.(canSubmit)
  }, [canSubmit, onCanSubmitChange])

  const handleFormFieldChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const submit = useCallback(async () => {
    setError(null)
    onSubmittingChange?.(true)
    try {
      const prepared = prepareEntityFormData(formData, displayableAttributes)
      await onSubmit(prepared)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'create'
            ? t('entity.failedToCreateEntity')
            : t('entity.failedToSave')
      )
    } finally {
      onSubmittingChange?.(false)
    }
  }, [displayableAttributes, formData, onSubmit, mode, onSubmittingChange, t])

  const getFormData = useCallback(
    () => prepareEntityFormData(formData, displayableAttributes),
    [displayableAttributes, formData]
  )

  const focusFirstField = useCallback(() => {
    const form = formRef.current
    if (!form || displayableAttributes.length === 0) return
    const firstNonAutosequence = displayableAttributes.find((attr) => !attr.autosequence)
    const attr = firstNonAutosequence ?? displayableAttributes[0]
    const fieldId = `${fieldIdPrefix}-${attr.name}`
    const el = form.querySelector(`[id="${fieldId}"]`) as HTMLElement | null
    if (!el) return
    // If the element is a container (e.g. object field wrapper), focus first focusable descendant
    const focusable =
      el.tagName === 'DIV' || el.tagName === 'SPAN'
        ? ((el.querySelector(
            'textarea, input:not([type="hidden"]), [contenteditable="true"]'
          ) as HTMLElement | null) ?? el)
        : el
    if (focusable?.focus) focusable.focus()
  }, [displayableAttributes, fieldIdPrefix])

  // Auto-focus first non-autosequence field when form becomes ready (e.g. modal opened)
  useEffect(() => {
    if (
      !autoFocusFirstField ||
      hasAutoFocusedRef.current ||
      displayableAttributes.length === 0 ||
      schemaLoading
    )
      return
    hasAutoFocusedRef.current = true
    const t = setTimeout(() => focusFirstField(), 0)
    return () => clearTimeout(t)
  }, [autoFocusFirstField, displayableAttributes.length, schemaLoading, focusFirstField])

  useImperativeHandle(
    ref,
    () => ({
      submit,
      getFormData,
      focusFirstField,
    }),
    [submit, getFormData, focusFirstField]
  )

  const renderFormField = (attr: SchemaAttr) => {
    const fieldValue = formData[attr.name]
    const fieldId = `${fieldIdPrefix}-${attr.name}`

    if (attr.type === 'image' || attr.type === 'blob') {
      return (
        <EntityFormUploadField
          key={attr.name}
          attr={attr}
          fieldValue={fieldValue}
          onFieldChange={handleFormFieldChange}
          fieldIdPrefix={fieldIdPrefix}
        />
      )
    }

    if (attr.type === 'bool' || isNumberAttrType(attr.type) || attr.type === 'date') {
      return (
        <EntityFormValueOrTemplateField
          key={`${attr.name}-${dataVersion}`}
          attrName={attr.name}
          attrType={attr.type}
          fieldId={fieldId}
          fieldValue={fieldValue}
          onFieldChange={handleFormFieldChange}
          envField={envField}
        />
      )
    }

    if (attr.type === 'duration') {
      return (
        <EntityFormDurationField
          key={attr.name}
          attr={attr}
          fieldValue={fieldValue}
          onFieldChange={handleFormFieldChange}
          fieldIdPrefix={fieldIdPrefix}
        />
      )
    }

    if (attr.type === 'object') {
      return (
        <EntityFormObjectField
          key={attr.name}
          attr={attr}
          fieldValue={fieldValue}
          onFieldChange={handleFormFieldChange}
          fieldIdPrefix={fieldIdPrefix}
        />
      )
    }

    if (attr.type === 'string' || attr.type === 'uuid') {
      return (
        <div key={attr.name} className="space-y-1.5">
          <Label htmlFor={fieldId} className="text-sm">
            {attr.name}
          </Label>
          <TemplatedTextInput
            id={fieldId}
            value={fieldValue != null ? String(fieldValue) : ''}
            onChange={(value) => handleFormFieldChange(attr.name, value || null)}
            {...envField}
          />
        </div>
      )
    }

    return (
      <div key={attr.name} className="space-y-1.5">
        <Label htmlFor={fieldId} className="text-sm">
          {attr.name}
        </Label>
        <TemplatedTextInput
          id={fieldId}
          value={fieldValue != null ? String(fieldValue) : ''}
          onChange={(value) => handleFormFieldChange(attr.name, value || null)}
          {...envField}
        />
      </div>
    )
  }

  const isFillHeight = scrollHeight === '100%'
  const rootClassName = isFillHeight ? 'flex h-full min-h-0 flex-col py-4' : 'py-4'
  const contentStyle = isFillHeight ? undefined : { height: scrollHeight }
  const contentClassName = isFillHeight ? 'h-full min-h-0 flex-1' : ''

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (canSubmit) void submit()
    },
    [canSubmit, submit]
  )

  return (
    <form ref={formRef} className={rootClassName} onSubmit={handleFormSubmit}>
      {/* Hidden submit so Enter in any input submits the form (implicit submission) */}
      <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
        Submit
      </button>
      {schemaLoading ? (
        <div
          className={`flex items-center justify-center ${contentClassName}`}
          style={contentStyle}
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayableAttributes.length === 0 ? (
        <div
          className={`flex items-center justify-center text-muted-foreground text-sm ${contentClassName}`}
          style={contentStyle}
        >
          {schema ? t('entity.noEditableFields') : t('entity.loadingSchema')}
        </div>
      ) : (
        <ScrollArea
          className={contentClassName}
          style={isFillHeight ? { minHeight: 0 } : { height: scrollHeight }}
        >
          <div className="space-y-4 pr-4">
            {displayableAttributes.map((attr) => renderFormField(attr))}
          </div>
        </ScrollArea>
      )}
      {showError && error && <ErrorList error={error} variant="inline" />}
    </form>
  )
})
