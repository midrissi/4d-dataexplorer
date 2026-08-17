import {
  Button,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { CircleAlert, Trash2 } from 'lucide-react'
import type { MutableRefObject, ReactNode } from 'react'
import { useTranslation } from '~/i18n'
import type { PickListDeclaration, PickListKind, PickListScope } from '~/lib/env'
import { ListRowActionsMenu } from './ListRowActionsMenu'

export function ListRowChrome({
  entry,
  nameIssue,
  placeholder,
  pendingFocusId,
  onNameChange,
  onTypeChange,
  onRemove,
  onRemoveExcept,
  transferTargets,
  onMoveTo,
  onDuplicateTo,
  children,
  trailing,
  trailingClassName,
}: {
  entry: PickListDeclaration
  nameIssue: 'invalid' | 'duplicate' | null
  placeholder: string
  pendingFocusId: MutableRefObject<string | null>
  onNameChange: (name: string) => void
  onTypeChange: (type: PickListKind) => void
  onRemove: () => void
  onRemoveExcept: () => void
  transferTargets: { value: PickListScope; label: string }[]
  onMoveTo: (scope: PickListScope) => void
  onDuplicateTo: (scope: PickListScope) => void
  children: ReactNode
  trailing: ReactNode
  trailingClassName?: string
}) {
  const { t } = useTranslation()
  const nameOk = nameIssue === null
  const nameErrorLabel =
    nameIssue === 'duplicate'
      ? t('lists.nameDuplicate')
      : nameIssue === 'invalid'
        ? t('lists.nameInvalid')
        : undefined
  const nameErrorId = `list-name-error-${entry.id}`

  const nameInput = (
    <Input
      ref={(el) => {
        if (el && pendingFocusId.current === entry.id) {
          el.focus()
          pendingFocusId.current = null
        }
      }}
      className={cn(
        'h-7 min-w-0 font-mono text-[10px]',
        !nameOk && 'border-destructive pr-6 focus-visible:ring-destructive'
      )}
      aria-label={t('lists.name')}
      aria-invalid={!nameOk || undefined}
      aria-describedby={!nameOk ? nameErrorId : undefined}
      placeholder={placeholder}
      value={entry.name}
      onChange={(event) => onNameChange(event.target.value)}
    />
  )

  return (
    <fieldset
      aria-label={entry.name.trim() || t('lists.newEntry')}
      className="grid min-h-9 grid-cols-[9rem_7rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-1.5 py-1 transition-colors hover:bg-muted/20"
    >
      <div className="relative w-full min-w-0">
        {nameInput}
        {nameErrorLabel ? (
          <>
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-1.5 text-destructive"
                    aria-label={nameErrorLabel}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <CircleAlert className="size-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  {nameErrorLabel}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span id={nameErrorId} className="sr-only">
              {nameErrorLabel}
            </span>
          </>
        ) : null}
      </div>
      <div className="focus-ring-wrap min-w-0">
        <Select value={entry.type} onValueChange={(value) => onTypeChange(value as PickListKind)}>
          <SelectTrigger className="h-7 min-w-0 text-[10px]" aria-label={t('lists.type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dataclass">{t('lists.typeDataclass')}</SelectItem>
            <SelectItem value="hardcoded">{t('lists.typeHardcoded')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0">{children}</div>
      <div className={trailingClassName ?? 'flex items-center gap-0.5'}>
        {trailing}
        <ListRowActionsMenu
          targets={transferTargets}
          onMoveTo={onMoveTo}
          onDuplicateTo={onDuplicateTo}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label={t('lists.remove')}
          title={t('lists.remove')}
          onClick={(event) => {
            if (event.shiftKey) {
              onRemoveExcept()
              return
            }
            onRemove()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </fieldset>
  )
}
