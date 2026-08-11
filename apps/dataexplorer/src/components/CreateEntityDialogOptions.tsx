import {
  Checkbox,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@4d/ui'
import { useTranslation } from '~/i18n'

export type CreateEntityAfterMode = 'close' | 'clear' | 'keep'

const MAX_CREATE_COUNT = 1000

type CreateEntityDialogOptionsProps = {
  createCount: number
  createCountInput: string
  afterCreate: CreateEntityAfterMode
  emptyBeforeInsert: boolean
  dataclassName: string
  isSubmitting: boolean
  showJsonFixHint: boolean
  onCreateCountInputChange: (raw: string) => void
  onCreateCountBlur: () => void
  onAfterCreateChange: (value: CreateEntityAfterMode) => void
  onEmptyBeforeInsertChange: (checked: boolean) => void
}

/** Dense bulk-create options: count, after-create, optional empty-before-insert. */
export function CreateEntityDialogOptions({
  createCount,
  createCountInput,
  afterCreate,
  emptyBeforeInsert,
  dataclassName,
  isSubmitting,
  showJsonFixHint,
  onCreateCountInputChange,
  onCreateCountBlur,
  onAfterCreateChange,
  onEmptyBeforeInsertChange,
}: CreateEntityDialogOptionsProps) {
  const { t } = useTranslation()
  const isBulk = createCount > 1

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)] items-end gap-x-3 gap-y-1.5">
        <div className="space-y-1">
          <Label htmlFor="create-entity-count" className="text-muted-foreground text-xs">
            {t('createEntity.createCount')}
          </Label>
          <Input
            id="create-entity-count"
            type="number"
            min={1}
            max={MAX_CREATE_COUNT}
            inputMode="numeric"
            value={createCountInput}
            disabled={isSubmitting}
            onChange={(e) => onCreateCountInputChange(e.target.value)}
            onBlur={onCreateCountBlur}
            className="h-8 w-full tabular-nums"
            aria-describedby="create-entity-count-hint"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="create-entity-after" className="text-muted-foreground text-xs">
            {t('createEntity.afterCreate')}
          </Label>
          <Select
            value={afterCreate}
            onValueChange={(value) => onAfterCreateChange(value as CreateEntityAfterMode)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="create-entity-after" className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="close">{t('createEntity.afterCreateClose')}</SelectItem>
              <SelectItem value="clear">{t('createEntity.afterCreateClear')}</SelectItem>
              <SelectItem value="keep">{t('createEntity.afterCreateKeep')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isBulk ? (
          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              id="create-entity-empty-before"
              checked={emptyBeforeInsert}
              disabled={isSubmitting}
              onCheckedChange={(checked) => onEmptyBeforeInsertChange(checked === true)}
              className={cn(
                emptyBeforeInsert &&
                  'border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive'
              )}
              title={t('createEntity.emptyBeforeInsertHint', { dataclassName })}
            />
            <Label
              htmlFor="create-entity-empty-before"
              className={cn(
                'cursor-pointer font-normal text-xs leading-none',
                emptyBeforeInsert ? 'text-destructive' : 'text-muted-foreground'
              )}
              title={t('createEntity.emptyBeforeInsertHint', { dataclassName })}
            >
              {t('createEntity.emptyBeforeInsert')}
            </Label>
          </div>
        ) : null}
      </div>

      <p
        id="create-entity-count-hint"
        className="w-full text-muted-foreground text-xs leading-snug"
      >
        {isBulk
          ? t('createEntity.createCountHintTemplates', { count: createCount })
          : t('createEntity.createCountHint')}
      </p>

      {showJsonFixHint ? (
        <p className="text-muted-foreground text-xs">{t('createEntity.fixJsonAbove')}</p>
      ) : null}
    </div>
  )
}

export { MAX_CREATE_COUNT }
