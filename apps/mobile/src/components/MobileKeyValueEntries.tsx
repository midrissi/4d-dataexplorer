import { Button, Input, Label } from '@4d/ui'
import { Plus, X } from 'lucide-react'
import { useTranslation } from '~/i18n'

export type KeyValueEntry = { id: string; key: string; value: string }

type MobileKeyValueEntriesProps = {
  title: string
  hint: string
  keyPlaceholder: string
  valuePlaceholder: string
  entries: KeyValueEntry[]
  onAdd: () => void
  onRemove: (index: number) => void
  onChange: (index: number, field: 'key' | 'value', value: string) => void
}

export function MobileKeyValueEntries({
  title,
  hint,
  keyPlaceholder,
  valuePlaceholder,
  entries,
  onAdd,
  onRemove,
  onChange,
}: MobileKeyValueEntriesProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label>{title}</Label>
          <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-1 px-2.5"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('connectionScreen.formAdd')}
        </Button>
      </div>

      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-2">
                <Input
                  className="h-11 text-base"
                  value={entry.key}
                  onChange={(e) => onChange(index, 'key', e.target.value)}
                  placeholder={keyPlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Input
                  className="h-11 text-base"
                  value={entry.value}
                  onChange={(e) => onChange(index, 'value', e.target.value)}
                  placeholder={valuePlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-11 w-11 shrink-0"
                onClick={() => onRemove(index)}
                aria-label={t('common.remove')}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
