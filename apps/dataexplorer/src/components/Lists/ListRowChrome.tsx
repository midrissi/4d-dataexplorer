import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@4d/ui'
import { Trash2 } from 'lucide-react'
import type { MutableRefObject, ReactNode } from 'react'
import { useTranslation } from '~/i18n'
import type { PickListDeclaration, PickListKind, PickListScope } from '~/lib/env'
import { ListRowActionsMenu } from './ListRowActionsMenu'

export function ListRowChrome({
  entry,
  nameOk,
  placeholder,
  gridClassName,
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
  footer,
}: {
  entry: PickListDeclaration
  nameOk: boolean
  placeholder: string
  gridClassName: string
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
  footer?: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <fieldset aria-label={entry.name.trim() || t('lists.newEntry')} className={gridClassName}>
      <Input
        ref={(el) => {
          if (el && pendingFocusId.current === entry.id) {
            el.focus()
            pendingFocusId.current = null
          }
        }}
        className="h-7 min-w-0 font-mono text-[10px]"
        aria-label={t('lists.name')}
        placeholder={placeholder}
        value={entry.name}
        aria-invalid={!nameOk}
        onChange={(event) => onNameChange(event.target.value)}
      />
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
      {children}
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
      {footer}
    </fieldset>
  )
}
