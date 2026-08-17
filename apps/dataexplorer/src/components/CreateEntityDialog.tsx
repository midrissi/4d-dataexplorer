import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useConfirm,
  useToast,
} from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import {
  AlertCircle,
  Check,
  FileText,
  HelpCircle,
  LayoutGrid,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type CreateEntityAfterMode,
  CreateEntityDialogOptions,
  MAX_CREATE_COUNT,
} from '~/components/CreateEntityDialogOptions'
import {
  CreateEntityProgress,
  type CreateEntityProgressState,
} from '~/components/CreateEntityProgress'
import { EntityForm, type EntityFormHandle } from '~/components/EntityForm'
import { useEditorLabels, useTranslation } from '~/i18n'
import { isAbortError } from '~/lib/abort'
import { mobileFullscreenDialogClass } from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'
import type { EditMode } from '~/store/settings'
import { useCodeEditorPrefs, useDefaultEditMode, useUpdateCodeEditorPrefs } from '~/store/settings'

const VALID_JSON_EXAMPLE = '{\n  "key": "value"\n}'

type AfterCreateMode = CreateEntityAfterMode

/** Convert character offset to 0-based row and column for Ace annotations */
function charOffsetToRowColumn(text: string, position: number): { row: number; column: number } {
  const lines = text.split('\n')
  let offset = 0
  for (let row = 0; row < lines.length; row++) {
    const lineLength = lines[row].length + (row < lines.length - 1 ? 1 : 0)
    if (offset + lineLength > position) {
      return { row, column: Math.min(position - offset, lines[row].length) }
    }
    offset += lineLength
  }
  return { row: lines.length - 1, column: lines[lines.length - 1]?.length ?? 0 }
}

function clampCreateCount(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_CREATE_COUNT, Math.max(1, Math.trunc(value)))
}

interface CreateEntityDialogProps {
  open: boolean
  onClose: () => void
  dataclassName: string
  initialData?: Record<string, unknown>
  isDuplicate?: boolean
  onSubmit: (
    data: Record<string, unknown>,
    options?: {
      refresh?: boolean
      count?: number
      emptyBeforeInsert?: boolean
      onProgress?: (current: number, total: number, phase: 'preparing' | 'creating') => void
      signal?: AbortSignal
    }
  ) => Promise<void>
  /** Refresh list/count after a create batch (or partial batch on error). */
  onRefresh?: () => Promise<void>
}

export function CreateEntityDialog({
  open,
  onClose,
  dataclassName,
  initialData,
  isDuplicate,
  onSubmit,
  onRefresh,
}: CreateEntityDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const mobile = isMobileShell()
  const editorLabels = useEditorLabels()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const defaultEditMode = useDefaultEditMode()
  const formRef = useRef<EntityFormHandle>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<CreateEntityProgressState | null>(null)
  const [canSubmit, setCanSubmit] = useState(true)
  const [afterCreate, setAfterCreate] = useState<AfterCreateMode>('close')
  const [createCount, setCreateCount] = useState(1)
  const [createCountInput, setCreateCountInput] = useState('1')
  const [emptyBeforeInsert, setEmptyBeforeInsert] = useState(false)
  const [formInitialData, setFormInitialData] = useState<Record<string, unknown>>({})
  const [editMode, setEditMode] = useState<EditMode>(defaultEditMode)
  const [jsonValue, setJsonValue] = useState('{\n  \n}')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [switchToFormError, setSwitchToFormError] = useState<boolean>(false)
  const [switchToFormErrorDetail, setSwitchToFormErrorDetail] = useState<string | null>(null)
  const [createSuccessShownAt, setCreateSuccessShownAt] = useState<number | null>(null)
  const [lastCreatedCount, setLastCreatedCount] = useState(1)

  useEffect(() => {
    if (open) {
      const data = initialData ?? {}
      setFormInitialData(data)
      setJsonValue(Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '{\n  \n}')
      // Mobile: form-first (JSON editor is awkward on small screens / soft keyboards)
      setEditMode(mobile ? 'form' : defaultEditMode)
      setJsonError(null)
      setSwitchToFormError(false)
      setSwitchToFormErrorDetail(null)
      setCreateSuccessShownAt(null)
      setLastCreatedCount(1)
      setEmptyBeforeInsert(false)
      setCreateCount(1)
      setCreateCountInput('1')
    } else {
      abortRef.current?.abort()
      abortRef.current = null
      setProgress(null)
    }
  }, [open, initialData, defaultEditMode, mobile])

  useEffect(() => {
    if (createSuccessShownAt === null) return
    const id = setTimeout(() => setCreateSuccessShownAt(null), 2500)
    return () => clearTimeout(id)
  }, [createSuccessShownAt])

  useEffect(() => {
    if (!mobile) setEditMode(defaultEditMode)
  }, [defaultEditMode, mobile])

  const handleSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      const times = clampCreateCount(createCount)
      const shouldEmpty = times > 1 && emptyBeforeInsert

      if (shouldEmpty) {
        const ok = await confirm({
          title: t('createEntity.emptyBeforeInsertConfirmTitle'),
          description: t('createEntity.emptyBeforeInsertConfirmDescription', {
            dataclassName,
            count: times,
          }),
          confirmText: t('createEntity.emptyBeforeInsertConfirm', { count: times }),
          cancelText: t('createEntity.cancel'),
          variant: 'destructive',
        })
        if (!ok) return
      }

      let created = 0
      const controller = new AbortController()
      abortRef.current = controller
      setProgress(
        shouldEmpty
          ? { phase: 'emptying' }
          : { phase: times > 1 ? 'preparing' : 'creating', current: 0, total: times }
      )
      try {
        await onSubmit(data, {
          refresh: false,
          count: times,
          emptyBeforeInsert: shouldEmpty,
          signal: controller.signal,
          onProgress: (current, total, phase) => setProgress({ phase, current, total }),
        })
        if (controller.signal.aborted) return
        created = times
        setProgress({ phase: 'refreshing' })
        await onRefresh?.()
        toast({
          title:
            created > 1
              ? t('createEntity.entitiesCreated', { count: created })
              : t('createEntity.entityCreated'),
          description: t('createEntity.createdDescription', {
            count: created,
            dataclass: dataclassName,
          }),
        })
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return
        toast({
          title: t('createEntity.createFailed'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        })
        throw err
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setProgress(null)
      }
      setLastCreatedCount(created)

      if (afterCreate === 'clear') {
        setFormInitialData({})
        setJsonValue('{\n  \n}')
        setCreateSuccessShownAt(Date.now())
        setTimeout(() => formRef.current?.focusFirstField(), 0)
        return
      }

      if (afterCreate === 'keep') {
        setCreateSuccessShownAt(Date.now())
        setTimeout(() => formRef.current?.focusFirstField(), 0)
        return
      }

      onClose()
    },
    [
      afterCreate,
      confirm,
      createCount,
      dataclassName,
      emptyBeforeInsert,
      onClose,
      onRefresh,
      onSubmit,
      t,
      toast,
    ]
  )

  const switchToForm = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonValue)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        setFormInitialData(parsed)
        setSwitchToFormError(false)
        setSwitchToFormErrorDetail(null)
        setJsonError(null)
        setEditMode('form')
      } else {
        setSwitchToFormError(true)
        setSwitchToFormErrorDetail(t('entity.valueMustBeJsonObject'))
      }
    } catch (err) {
      setSwitchToFormError(true)
      setSwitchToFormErrorDetail(
        err instanceof SyntaxError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('entity.invalidJson')
      )
    }
  }, [jsonValue, t])

  const { jsonAnnotations, errorLocation } = useMemo(() => {
    if (!switchToFormError || !switchToFormErrorDetail) {
      return {
        jsonAnnotations: undefined,
        errorLocation: null as { line: number; column: number } | null,
      }
    }
    const positionMatch = /position\s+(\d+)/i.exec(switchToFormErrorDetail)
    const position = positionMatch ? Number.parseInt(positionMatch[1], 10) : 0
    const { row, column } = charOffsetToRowColumn(jsonValue, position)
    const jsonAnnotations = [{ row, column, text: switchToFormErrorDetail, type: 'error' as const }]
    const errorLocation = { line: row + 1, column: column + 1 }
    return { jsonAnnotations, errorLocation }
  }, [switchToFormError, switchToFormErrorDetail, jsonValue])

  const insertValidExample = useCallback(() => {
    setJsonValue(VALID_JSON_EXAMPLE)
    setSwitchToFormError(false)
    setSwitchToFormErrorDetail(null)
    setJsonError(null)
  }, [])

  const proceedWithEmptyForm = useCallback(() => {
    setFormInitialData({})
    setJsonValue('{\n  \n}')
    setSwitchToFormError(false)
    setSwitchToFormErrorDetail(null)
    setJsonError(null)
    setEditMode('form')
  }, [])

  const switchToJson = useCallback(() => {
    const data = formRef.current?.getFormData() ?? formInitialData
    try {
      setJsonValue(JSON.stringify(data, null, 2))
    } catch {
      setJsonValue('{\n  \n}')
    }
    setJsonError(null)
    setEditMode('json')
  }, [formInitialData])

  const handleCreateClick = useCallback(async () => {
    if (editMode === 'form') {
      formRef.current?.submit()
    } else {
      setJsonError(null)
      try {
        const parsed = JSON.parse(jsonValue)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setJsonError(t('entity.valueMustBeJsonObject'))
          return
        }
        setIsSubmitting(true)
        await handleSubmit(parsed)
      } catch (err) {
        if (err instanceof SyntaxError) {
          setJsonError(t('entity.invalidJsonSyntax'))
        } else {
          setJsonError(err instanceof Error ? err.message : t('entity.invalidJson'))
        }
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [editMode, jsonValue, handleSubmit, t])

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editMode !== 'form' || e.key !== 'Enter') return
      const target = e.target as HTMLElement
      // Don't submit when Enter is pressed in a code editor (e.g. object attribute field)
      if (target.closest?.('.ace_editor')) return
      if (
        target.tagName !== 'INPUT' &&
        target.tagName !== 'TEXTAREA' &&
        target.tagName !== 'SELECT'
      )
        return
      const form = (target as HTMLInputElement).form
      if (form) {
        e.preventDefault()
        e.stopPropagation()
        formRef.current?.submit()
      }
    },
    [editMode]
  )

  const successMessage =
    lastCreatedCount > 1
      ? t('createEntity.entitiesCreated', { count: lastCreatedCount })
      : t('createEntity.entityCreated')

  const headerContent = (
    <DialogHeader>
      <DialogTitle>
        {isDuplicate ? t('createEntity.duplicateEntity') : t('createEntity.createEntity')}
      </DialogTitle>
      <DialogDescription>
        {isDuplicate
          ? t('createEntity.duplicateEntityDescription', { dataclassName })
          : t('createEntity.createEntityDescription', { dataclassName })}
      </DialogDescription>
      <div className="flex gap-0.5 rounded-lg border p-0.5">
        <Button
          type="button"
          variant={editMode === 'form' ? 'default' : 'ghost'}
          size="sm"
          onClick={switchToForm}
          className={cn('flex flex-1 gap-1 text-xs', mobile ? 'h-10 py-2' : 'py-1.5')}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t('createEntity.form')}
        </Button>
        <Button
          type="button"
          variant={editMode === 'json' ? 'default' : 'ghost'}
          size="sm"
          onClick={switchToJson}
          className={cn('flex flex-1 gap-1 text-xs', mobile ? 'h-10 py-2' : 'py-1.5')}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('createEntity.json')}
        </Button>
      </div>
    </DialogHeader>
  )

  const bodyContent = (
    <>
      {createSuccessShownAt !== null && (
        <output
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary"
          aria-live="polite"
        >
          <Check className="h-4 w-4 shrink-0" />
          <span className="font-medium text-sm">{successMessage}</span>
        </output>
      )}

      {editMode === 'form' ? (
        <EntityForm
          ref={formRef}
          dataclassName={dataclassName}
          initialData={formInitialData}
          mode="create"
          onSubmit={handleSubmit}
          scrollHeight={mobile ? '100%' : '300px'}
          fieldIdPrefix="create-entity"
          onSubmittingChange={setIsSubmitting}
          onCanSubmitChange={setCanSubmit}
          autoFocusFirstField
        />
      ) : (
        <>
          <div
            className="rounded-lg pt-4 pb-1.5"
            style={{ height: mobile ? '100%' : '300px', minHeight: mobile ? '240px' : undefined }}
          >
            <CodeEditor
              value={jsonValue}
              onChange={(value) => {
                setJsonValue(value)
                setSwitchToFormError(false)
                setSwitchToFormErrorDetail(null)
                setJsonError(null)
              }}
              error={!!jsonError || !!switchToFormError}
              annotations={jsonAnnotations}
              showLineNumbers
              highlightActiveLine
              height="100%"
              toolbar
              labels={editorLabels}
              editorPrefs={codeEditorPrefs}
              onEditorPrefsChange={updateCodeEditorPrefs}
            />
          </div>
          {switchToFormError && (
            <div
              className="fade-in-0 slide-in-from-top-1 mt-1.5 animate-in rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-3 shadow-sm duration-200"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/20">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-destructive">
                      {t('createEntity.invalidJson')}
                    </span>
                    {errorLocation && (
                      <span className="rounded-md bg-destructive/20 px-1.5 py-0.5 font-mono text-destructive text-xs">
                        line {errorLocation.line}, col {errorLocation.column}
                      </span>
                    )}
                  </div>
                  {switchToFormErrorDetail && (
                    <p className="text-destructive/90 text-xs leading-relaxed">
                      {switchToFormErrorDetail}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-destructive/20 border-t pt-2 text-xs">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={insertValidExample}
                      className="inline-flex h-auto items-center gap-1 p-0 font-medium text-destructive underline-offset-2"
                    >
                      <Sparkles className="h-3 w-3 shrink-0" />
                      {t('createEntity.insertValidExample')}
                    </Button>
                    <span className="text-muted-foreground">·</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={proceedWithEmptyForm}
                      className="h-auto p-0 font-medium text-destructive underline-offset-2"
                    >
                      {t('createEntity.proceedWithEmptyForm')}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1 rounded-lg bg-background/50 px-2 py-1.5 text-muted-foreground text-xs">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                {t('createEntity.jsonHelpKeys')}
              </p>
            </div>
          )}
          {!switchToFormError && jsonError && (
            <div
              className="fade-in-0 slide-in-from-top-1 mt-1.5 flex animate-in flex-col gap-2 rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-3 shadow-sm duration-200"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/20">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                </div>
                <p className="min-w-0 flex-1 font-medium text-destructive text-sm">{jsonError}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-destructive/20 border-t pt-2 text-xs">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={insertValidExample}
                  className="inline-flex h-auto items-center gap-1 p-0 font-medium text-destructive underline-offset-2"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  {t('createEntity.insertValidExample')}
                </Button>
              </div>
              <p className="flex items-center gap-1 rounded-lg bg-background/50 px-2 py-1.5 text-muted-foreground text-xs">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                {t('createEntity.jsonHelpFix')}
              </p>
            </div>
          )}
        </>
      )}
    </>
  )

  const footerContent = (
    <DialogFooter className="flex-col gap-3 sm:flex-col sm:items-stretch sm:space-x-0">
      <CreateEntityDialogOptions
        createCount={createCount}
        createCountInput={createCountInput}
        afterCreate={afterCreate}
        emptyBeforeInsert={emptyBeforeInsert}
        dataclassName={dataclassName}
        isSubmitting={isSubmitting}
        showJsonFixHint={editMode === 'json' && (!!jsonError || !!switchToFormError)}
        onCreateCountInputChange={(raw) => {
          setCreateCountInput(raw)
          const parsed = Number.parseInt(raw, 10)
          if (!Number.isNaN(parsed)) {
            const next = clampCreateCount(parsed)
            setCreateCount(next)
            if (next <= 1) setEmptyBeforeInsert(false)
          }
        }}
        onCreateCountBlur={() => {
          const next = clampCreateCount(Number.parseInt(createCountInput, 10) || 1)
          setCreateCount(next)
          setCreateCountInput(String(next))
          if (next <= 1) setEmptyBeforeInsert(false)
        }}
        onAfterCreateChange={setAfterCreate}
        onEmptyBeforeInsertChange={setEmptyBeforeInsert}
      />
      <div className={cn('flex w-full items-center gap-2', mobile && 'flex-col-reverse')}>
        <div className="min-w-0 flex-1">
          {progress ? (
            <CreateEntityProgress
              progress={progress}
              dataclassName={dataclassName}
              onCancel={() => abortRef.current?.abort()}
            />
          ) : null}
        </div>
        <div className={cn('flex shrink-0 justify-end gap-2', mobile && 'w-full')}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className={mobile ? 'h-11' : undefined}
          >
            {t('createEntity.cancel')}
          </Button>
          <Button
            variant={emptyBeforeInsert && createCount > 1 ? 'destructive' : 'default'}
            onClick={handleCreateClick}
            disabled={
              isSubmitting ||
              (editMode === 'form' && !canSubmit) ||
              (editMode === 'json' && (!!jsonError || !!switchToFormError))
            }
            title={
              editMode === 'json' && (jsonError || switchToFormError)
                ? t('createEntity.fixJsonOrUse')
                : emptyBeforeInsert && createCount > 1
                  ? t('createEntity.emptyBeforeInsertHint', { dataclassName })
                  : undefined
            }
            className={mobile ? 'h-11' : undefined}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('createEntity.creating')}
              </>
            ) : createCount > 1 ? (
              t('createEntity.createN', { count: createCount })
            ) : (
              t('createEntity.create')
            )}
          </Button>
        </div>
      </div>
    </DialogFooter>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          className={cn(mobile ? mobileFullscreenDialogClass() : 'sm:max-w-2xl')}
          onKeyDown={handleContentKeyDown}
        >
          {mobile ? (
            <>
              <div className="shrink-0 border-b px-3 pt-3 pb-2.5">{headerContent}</div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{bodyContent}</div>
              <div className="shrink-0 border-t px-3 pt-3 pb-3">{footerContent}</div>
            </>
          ) : (
            <>
              {headerContent}
              {bodyContent}
              {footerContent}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </>
  )
}
