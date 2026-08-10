import { dateValueToInputValue } from '@4d/rest'
import {
  Checkbox,
  DatePicker,
  Input,
  Label,
  ScrollArea,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Calculator, Loader2, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  BinaryObjectViewer,
  isPrivateBinaryObject,
  PRIVATE_BINARY_OBJECT_KEY,
} from '~/components/BinaryObjectViewer'
import { ErrorList } from '~/components/ErrorList'
import { PullToRefresh } from '~/components/PullToRefresh'
import { getIntlLocale, useEditorLabels, useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { isRelationAttribute } from '~/lib/entity-viewer/attributes'
import { getDeferredRelation } from '~/lib/entity-viewer/deferred'
import { isMobileShell } from '~/lib/platform'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'
import { BlobField } from './BlobField'
import { DeferredRelation } from './DeferredRelation'
import { FormViewDurationField } from './FormViewDurationField'
import { ImageField } from './ImageField'
import { NullRelatedEntityCard } from './NullRelatedEntityCard'
import { ObjectCodeField } from './ObjectCodeField'

export function FormView({
  entity,
  dataclassName,
  isEditing,
  readonlyMode,
  onFieldChange,
  entityId,
  onRefresh,
}: {
  entity: Record<string, unknown>
  dataclassName: string | null
  isEditing: boolean
  readonlyMode: boolean
  onFieldChange: (field: string, value: unknown) => void
  entityId: string | null
  onRefresh?: () => void | Promise<void>
}) {
  const { t, language } = useTranslation()
  const mobile = isMobileShell()
  const editorLabels = useEditorLabels()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const [schema, setSchema] = useState<Awaited<ReturnType<typeof api.getDataclassSchema>> | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch schema when dataclass changes
  useEffect(() => {
    if (!dataclassName) {
      setSchema(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    api
      .getDataclassSchema(dataclassName)
      .then((s) => {
        setSchema(s)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('entity.failedToLoadSchema'))
        setLoading(false)
      })
  }, [dataclassName, t])

  // Get displayable attributes (filter out system fields, primary key).
  // Relations are shown inline (as loaders) in view mode but hidden in edit mode.
  // Readonly fields are shown in view mode but hidden in edit mode.
  const displayableAttributes = useMemo(() => {
    if (!schema) return []

    const primaryKey = schema.key
    const systemFields = new Set(['__TIMESTAMP', '__KEY', '__STAMP', '__DATACLASS'])

    return schema.attributes.filter((attr) => {
      // Skip system fields
      if (systemFields.has(attr.name)) return false
      // Skip primary key
      if (attr.name === primaryKey) return false
      // Relations can't be edited inline — hide them in edit mode
      if (isEditing && (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities'))
        return false
      // Include image and blob (upload in edit mode)
      // Hide readonly fields in edit mode
      if (isEditing && attr.readOnly) return false
      return true
    })
  }, [schema, isEditing])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ErrorList error={error} title={t('common.somethingWentWrong')} variant="centered" />
      </div>
    )
  }

  if (!schema || displayableAttributes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          {schema ? t('entity.noFieldsAvailable') : t('entity.schemaNotAvailable')}
        </p>
      </div>
    )
  }

  // Helper component for field label with icons
  const FieldLabel = ({
    htmlFor,
    children,
    attr,
  }: {
    htmlFor: string
    children: React.ReactNode
    attr: (typeof displayableAttributes)[0]
  }) => (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm">
      <span>{children}</span>
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
        {attr.kind === 'calculated' && (
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
  )

  const renderField = (attr: (typeof displayableAttributes)[0]) => {
    const value = entity[attr.name]
    const isReadonly = attr.readOnly || readonlyMode || !isEditing
    const fieldId = `field-${attr.name}`

    // Loadable relation (related entity or entity set) — render an inline loader
    // card instead of raw JSON. Detected by value so alias relations are caught too.
    const deferredRel = getDeferredRelation(value)
    if (deferredRel) {
      const relKind =
        attr.kind === 'relatedEntities'
          ? 'relatedEntities'
          : attr.kind === 'relatedEntity'
            ? 'relatedEntity'
            : deferredRel.key != null
              ? 'relatedEntity'
              : 'relatedEntities'
      return (
        <DeferredRelation
          key={attr.name}
          name={attr.name}
          uri={deferredRel.uri}
          kind={relKind}
          relatedDataclass={typeof attr.type === 'string' ? attr.type : undefined}
          displayMode="form"
        />
      )
    }

    // Null / missing relatedEntity — show relation chrome + schema metadata
    // instead of falling through to a JSON `null` object tree.
    if (isRelationAttribute(attr) && (value === null || value === undefined)) {
      return (
        <NullRelatedEntityCard
          key={attr.name}
          attr={attr}
          foreignKeyValue={attr.foreignKey ? entity[attr.foreignKey] : undefined}
        />
      )
    }

    // Boolean fields
    if (attr.type === 'bool') {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <div />
          <div className="flex items-center gap-2">
            <Checkbox
              id={fieldId}
              checked={value === true}
              onCheckedChange={(checked) => onFieldChange(attr.name, checked === true)}
              disabled={isReadonly}
            />
            <FieldLabel htmlFor={fieldId} attr={attr}>
              {attr.name}
            </FieldLabel>
          </div>
        </div>
      )
    }

    // Number fields
    if (
      ['number', 'long', 'long64', 'word', 'byte'].includes(attr.type) ||
      (typeof attr.type === 'string' && attr.type.startsWith('number'))
    ) {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <Input
            id={fieldId}
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) => {
              const numValue = e.target.value === '' ? null : Number(e.target.value)
              onFieldChange(attr.name, numValue)
            }}
            readOnly={isReadonly}
            disabled={isReadonly}
          />
        </div>
      )
    }

    // Date fields
    if (attr.type === 'date') {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <DatePicker
            id={fieldId}
            value={dateValueToInputValue(value) || null}
            onChange={(next) => onFieldChange(attr.name, next)}
            locale={getIntlLocale(language)}
            disabled={isReadonly}
            labels={{
              placeholder: t('entity.datePickerPlaceholder'),
              clear: t('entity.datePickerClear'),
              today: t('entity.datePickerToday'),
              previousMonth: t('entity.datePickerPreviousMonth'),
              nextMonth: t('entity.datePickerNextMonth'),
              month: t('entity.datePickerMonth'),
              year: t('entity.datePickerYear'),
              openCalendar: t('entity.datePickerOpen', { field: attr.name }),
            }}
            aria-label={attr.name}
          />
        </div>
      )
    }

    // Duration fields
    if (attr.type === 'duration') {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <FormViewDurationField
            attr={attr}
            value={value}
            onFieldChange={onFieldChange}
            fieldId={fieldId}
            isReadonly={isReadonly}
          />
        </div>
      )
    }

    // Image fields
    if (attr.type === 'image') {
      return (
        <ImageField
          key={attr.name}
          attr={attr}
          entity={entity}
          dataclassName={dataclassName}
          entityId={entityId}
          isEditing={isEditing}
          isReadonly={isReadonly}
          onFieldChange={onFieldChange}
        />
      )
    }

    // Blob fields (generic file upload)
    if (attr.type === 'blob') {
      return (
        <BlobField
          key={attr.name}
          attr={attr}
          entity={entity}
          isEditing={isEditing}
          isReadonly={isReadonly}
          onFieldChange={onFieldChange}
        />
      )
    }

    // String fields (check if multiline)
    if (attr.type === 'string' || attr.type === 'uuid') {
      const isMultiline = typeof value === 'string' && value.length > 100

      if (isMultiline) {
        return (
          <div key={attr.name} className="space-y-2">
            <FieldLabel htmlFor={fieldId} attr={attr}>
              {attr.name}
            </FieldLabel>
            <Textarea
              id={fieldId}
              value={value != null ? String(value) : ''}
              onChange={(e) => onFieldChange(attr.name, e.target.value || null)}
              readOnly={isReadonly}
              disabled={isReadonly}
              rows={6}
            />
          </div>
        )
      }

      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <Input
            id={fieldId}
            type="text"
            value={value != null ? String(value) : ''}
            onChange={(e) => onFieldChange(attr.name, e.target.value || null)}
            readOnly={isReadonly}
            disabled={isReadonly}
          />
        </div>
      )
    }

    // 4D private binary object (blob/picture serialised as base64)
    if (isPrivateBinaryObject(value)) {
      return (
        <div key={attr.name} className="space-y-2">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <BinaryObjectViewer base64={value[PRIVATE_BINARY_OBJECT_KEY]} name={attr.name} />
        </div>
      )
    }

    // Object/unknown types — console JSON tree in view mode; code editor when editing.
    return (
      <div key={attr.name} className="space-y-2">
        <FieldLabel htmlFor={fieldId} attr={attr}>
          {attr.name}
        </FieldLabel>
        <ObjectCodeField
          key={`${entityId ?? 'new'}-${attr.name}-${isReadonly}`}
          value={value}
          isReadonly={isReadonly}
          onChange={(next) => onFieldChange(attr.name, next)}
          labels={editorLabels}
          editorPrefs={codeEditorPrefs}
          onEditorPrefsChange={updateCodeEditorPrefs}
        />
      </div>
    )
  }

  return mobile && onRefresh ? (
    <PullToRefresh
      className="h-full min-h-0"
      label={t('entity.pullToRefresh')}
      onRefresh={onRefresh}
    >
      <div className="space-y-3 p-4 pb-6">
        {displayableAttributes.map((attr) => renderField(attr))}
      </div>
    </PullToRefresh>
  ) : (
    <ScrollArea className="h-full min-h-0 flex-1">
      <div className="space-y-3 p-4">{displayableAttributes.map((attr) => renderField(attr))}</div>
    </ScrollArea>
  )
}
