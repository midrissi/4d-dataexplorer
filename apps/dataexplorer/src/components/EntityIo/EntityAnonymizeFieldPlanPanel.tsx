import {
  Button,
  ClickToCopy,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SegmentedControl,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Braces, Copy, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from '~/i18n'
import type { AnonymizeFieldMode, AnonymizeFieldPlan, EntityIoAttribute } from '~/lib/entity-io'
import type { EnvTemplateThis } from '~/lib/env/this-context'
import { AnonymizeFieldRow } from './AnonymizeFieldRow'
import { EntityIoCodePreview } from './EntityIoCodePreview'
import { EntityIoPanel } from './EntityIoPanel'
import type { EntityIoSelectOption } from './EntityIoSelect'

export function EntityAnonymizeFieldPlanPanel({
  plan,
  planView,
  planJson,
  planJsonDraft,
  planJsonError,
  mappableAttributes,
  availableToAdd,
  modeOptions,
  thisRoot,
  lists,
  listNames,
  onManageVariables,
  onPlanViewChange,
  onUpdatePlanJson,
  onApplyPlanJson,
  onAddField,
  onResetPlan,
  onClearPlan,
  onFieldNameChange,
  onChange,
  onRemove,
  onRemoveExcept,
  fieldOptionsFor,
}: {
  plan: AnonymizeFieldPlan[]
  planView: 'form' | 'json'
  planJson: string
  planJsonDraft: string
  planJsonError: boolean
  mappableAttributes: EntityIoAttribute[]
  availableToAdd: EntityIoAttribute[]
  modeOptions: EntityIoSelectOption<AnonymizeFieldMode>[]
  thisRoot?: EnvTemplateThis
  lists: Record<string, readonly string[]>
  listNames: readonly string[]
  onManageVariables: () => void
  onPlanViewChange: (next: 'form' | 'json') => void
  onUpdatePlanJson: (value: string) => void
  onApplyPlanJson: () => boolean
  onAddField: (name: string) => void
  onResetPlan: () => void
  onClearPlan: () => void
  onFieldNameChange: (from: string, to: string) => void
  onChange: (name: string, patch: Partial<AnonymizeFieldPlan>) => void
  onRemove: (name: string) => void
  onRemoveExcept: (name: string) => void
  fieldOptionsFor: (currentName: string) => EntityIoSelectOption<string>[]
}) {
  const { t } = useTranslation()

  const viewOptions = useMemo(
    () => [
      { value: 'form' as const, label: t('entity.io.fieldPlanForm'), icon: ListChecks },
      { value: 'json' as const, label: t('entity.io.fieldPlanJson'), icon: Braces },
    ],
    [t]
  )

  return (
    <EntityIoPanel
      icon={ListChecks}
      title={t('entity.io.fieldPlan')}
      count={plan.length}
      contentClassName="max-h-64 overflow-auto overscroll-contain p-0"
      action={
        <div className="flex items-center gap-0.5">
          <TooltipProvider delayDuration={250}>
            {planView === 'form' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      disabled={plan.length === 0}
                      aria-label={t('entity.io.removeAllFields')}
                      onClick={onClearPlan}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('entity.io.removeAllFields')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      disabled={mappableAttributes.length === 0}
                      aria-label={t('entity.io.resetFieldPlan')}
                      onClick={onResetPlan}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('entity.io.resetFieldPlan')}</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          disabled={availableToAdd.length === 0}
                          aria-label={t('entity.io.addField')}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t('entity.io.addField')}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
                    {availableToAdd.map((attr) => (
                      <DropdownMenuItem
                        key={attr.name}
                        className="font-mono text-xs"
                        onSelect={() => onAddField(attr.name)}
                      >
                        {attr.name}
                        <span className="ml-2 text-muted-foreground">{attr.type}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <ClickToCopy
                value={planJson}
                tooltipLabel={t('entity.io.copyFieldPlan')}
                tooltipCopiedLabel={t('common.copied')}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t('entity.io.copyFieldPlan')}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
              </ClickToCopy>
            )}
          </TooltipProvider>
          <SegmentedControl
            value={planView}
            onValueChange={(next) => {
              if (planView === 'json' && next !== 'json' && !onApplyPlanJson()) return
              onPlanViewChange(next)
            }}
            aria-label={t('entity.io.fieldPlanView')}
            className="ml-1 shrink-0"
            options={viewOptions}
          />
        </div>
      }
    >
      {planView === 'json' ? (
        <div>
          <EntityIoCodePreview
            value={planJsonDraft}
            language="json"
            height={220}
            onChange={onUpdatePlanJson}
            onBlur={onApplyPlanJson}
          />
          {planJsonError ? (
            <p className="px-2 py-1 text-destructive text-xs" role="alert">
              {t('entity.io.fieldPlanJsonInvalid')}
            </p>
          ) : null}
        </div>
      ) : plan.length === 0 ? (
        <p className="p-2 text-muted-foreground text-xs">{t('entity.io.fieldPlanEmpty')}</p>
      ) : (
        <>
          {plan.map((field) => (
            <AnonymizeFieldRow
              key={field.name}
              field={field}
              fieldOptions={fieldOptionsFor(field.name)}
              modeOptions={modeOptions}
              fieldLabel={t('entity.io.fieldName')}
              modeLabel={t('entity.io.importMode')}
              removeLabel={t('entity.io.removeField')}
              thisRoot={thisRoot}
              lists={lists}
              listNames={listNames}
              onManageVariables={onManageVariables}
              onFieldNameChange={onFieldNameChange}
              onChange={onChange}
              onRemove={onRemove}
              onRemoveExcept={onRemoveExcept}
            />
          ))}
          <p className="border-border/50 border-t px-2 py-1.5 text-muted-foreground text-xs">
            {t('entity.io.fieldPlanKeepOnlyHint')}
          </p>
        </>
      )}
    </EntityIoPanel>
  )
}
