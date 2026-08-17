import { Button, Dialog, useConfirm } from '@4d/ui'
import { Shield } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import {
  type AnonymizeFieldMode,
  buildDefaultAnonymizePlan,
  type EntityIoAttribute,
  type EntityIoFormatId,
  listAnonymizeMappableAttributes,
} from '~/lib/entity-io'
import type { EntityIoTarget } from '~/lib/eventBus'
import { EntityAnonymizeActionsMenu } from './EntityAnonymizeActionsMenu'
import { EntityAnonymizeFieldPlanPanel } from './EntityAnonymizeFieldPlanPanel'
import { EntityAnonymizePreviewPanel } from './EntityAnonymizePreviewPanel'
import { EntityAnonymizeSettingsPanel } from './EntityAnonymizeSettingsPanel'
import { EntityIoAnonymizeProgress } from './EntityIoAnonymizeProgress'
import { EntityIoDialogFrame } from './EntityIoDialogFrame'
import type { EntityIoSelectOption } from './EntityIoSelect'
import { useAnonymizeLists } from './use-anonymize-lists'
import { useAnonymizePlan } from './use-anonymize-plan'
import { useAnonymizeRun } from './use-anonymize-run'
import { useAnonymizeSample } from './use-anonymize-sample'

export function EntityAnonymizeDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: EntityIoTarget | null
}) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const [mappableAttributes, setMappableAttributes] = useState<EntityIoAttribute[]>([])
  const [primaryKey, setPrimaryKey] = useState<string | undefined>()
  const [seed, setSeed] = useState('')
  const [formatId, setFormatId] = useState<EntityIoFormatId>('json')

  const dataclassName = target?.dataclassName ?? ''
  const sampleEntitySetId = target?.entitySetId?.trim() ?? ''
  const hasEntitySet = Boolean(sampleEntitySetId)
  const closeForManageVariables = useCallback(() => onOpenChange(false), [onOpenChange])

  const planState = useAnonymizePlan({ mappableAttributes, confirm })
  const { setPlan } = planState
  const listsState = useAnonymizeLists({
    open,
    plan: planState.plan,
    planFakerTemplates: planState.planFakerTemplates,
  })
  const { resetLists } = listsState
  const sampleState = useAnonymizeSample({
    open,
    dataclassName,
    entitySetId: sampleEntitySetId,
    plan: planState.plan,
    seed,
    formatId,
    primaryKey,
    mappableAttributes,
    lists: listsState.anonymizeLists,
  })
  const runState = useAnonymizeRun({
    target,
    plan: planState.plan,
    seed,
    formatId,
    primaryKey,
    confirm,
    onOpenChange,
    ensureReferencedLists: listsState.ensureReferencedLists,
  })

  const modeOptions = useMemo(
    (): EntityIoSelectOption<AnonymizeFieldMode>[] => [
      { value: 'faker', label: t('entity.io.modeFaker') },
      { value: 'fixed', label: t('entity.io.modeFixed') },
      { value: 'keep', label: t('entity.io.modeKeep') },
      { value: 'empty', label: t('entity.io.modeEmpty') },
    ],
    [t]
  )

  useEffect(() => {
    if (!open || !dataclassName) return
    let cancelled = false
    void api.getDataclassSchema(dataclassName).then((schema) => {
      if (cancelled) return
      const attrs = listAnonymizeMappableAttributes(
        schema.attributes as EntityIoAttribute[],
        schema.key
      )
      setPrimaryKey(schema.key)
      setMappableAttributes(attrs)
      setPlan(buildDefaultAnonymizePlan(schema.attributes as EntityIoAttribute[], schema.key))
      resetLists()
    })
    return () => {
      cancelled = true
    }
  }, [open, dataclassName, setPlan, resetLists])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <EntityIoDialogFrame
          icon={Shield}
          title={t('entity.io.anonymizeTitle')}
          description={t('entity.io.anonymizeDescription', { dataclass: dataclassName })}
          badge={hasEntitySet ? t('entity.io.scopeSelection') : undefined}
          size="lg"
          footer={
            <>
              <div className="min-w-0 flex-1">
                {runState.progress ? (
                  <EntityIoAnonymizeProgress
                    progress={runState.progress}
                    onCancel={runState.cancelAnonymization}
                  />
                ) : null}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={runState.busy}
                >
                  {t('entity.cancel')}
                </Button>
                <EntityAnonymizeActionsMenu
                  busy={runState.busy}
                  disabled={runState.busy || !hasEntitySet || planState.plan.length === 0}
                  hasAnonymizedFields={planState.hasAnonymizedFields}
                  onDownload={() => void runState.handleDownload()}
                  onImport={(removeExisting) => void runState.handleImport(removeExisting)}
                  onUpdateExisting={() => void runState.handleUpdateExisting()}
                />
              </div>
            </>
          }
        >
          {!hasEntitySet ? (
            <p
              role="alert"
              className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-warning text-xs"
            >
              {t('entity.deleteManySelectionUnavailable')}
            </p>
          ) : null}

          <EntityAnonymizeSettingsPanel
            seed={seed}
            formatId={formatId}
            onSeedChange={setSeed}
            onFormatChange={setFormatId}
          />

          <EntityAnonymizeFieldPlanPanel
            plan={planState.plan}
            planView={planState.planView}
            planJson={planState.planJson}
            planJsonDraft={planState.planJsonDraft}
            planJsonError={planState.planJsonError}
            mappableAttributes={mappableAttributes}
            availableToAdd={planState.availableToAdd}
            modeOptions={modeOptions}
            thisRoot={sampleState.anonymizeThisRoot}
            lists={listsState.anonymizeLists}
            listNames={listsState.anonymizeListNames}
            onManageVariables={closeForManageVariables}
            onPlanViewChange={planState.setPlanView}
            onUpdatePlanJson={planState.updatePlanJson}
            onApplyPlanJson={planState.applyPlanJson}
            onAddField={planState.addField}
            onResetPlan={planState.resetPlan}
            onClearPlan={planState.clearPlan}
            onFieldNameChange={planState.replaceField}
            onChange={planState.updateField}
            onRemove={planState.removeField}
            onRemoveExcept={(name) => void planState.removeAllFieldsExcept(name)}
            fieldOptionsFor={planState.fieldOptionsFor}
          />

          <EntityAnonymizePreviewPanel
            previewCount={sampleState.preview.length}
            previewText={sampleState.previewText}
            formatId={formatId}
            hasEntitySet={hasEntitySet}
            loading={sampleState.loading}
            onRefresh={() => void sampleState.loadSample()}
          />
        </EntityIoDialogFrame>
      </Dialog>
      <ConfirmDialog />
    </>
  )
}
