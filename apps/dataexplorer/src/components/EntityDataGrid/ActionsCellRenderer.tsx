import { Button, ClickToCopy } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { Entity } from '~/store'

export function ActionsCellRenderer(
  props: ICellRendererParams & {
    readonlyMode: boolean
    onCopyJson: (entity: Entity) => void
    onDuplicate: (entity: Entity) => void
    onDelete: (entity: Entity) => void
    duplicateShortcut?: string
    deleteShortcut?: string
  }
) {
  const { t } = useTranslation()
  const entity = props.data as Entity
  if (!entity) return null

  return (
    <div className="relative z-1 flex h-full w-full items-center justify-center gap-1">
      <ClickToCopy
        value={JSON.stringify(entity, null, 2)}
        tooltipLabel={t('entity.copyJson')}
        tooltipCopiedLabel={t('common.copied')}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
      >
        <Copy className="h-4 w-4" />
      </ClickToCopy>
      {!props.readonlyMode && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => props.onDuplicate(entity)}
            title={
              props.duplicateShortcut
                ? `${t('entity.duplicate')} (${props.duplicateShortcut})`
                : t('entity.duplicate')
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => props.onDelete(entity)}
            title={
              props.deleteShortcut
                ? `${t('entity.delete')} (${props.deleteShortcut})`
                : t('entity.delete')
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
