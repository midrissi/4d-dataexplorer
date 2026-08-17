import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@4d/ui'
import {
  ChevronDown,
  Download,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react'
import { useTranslation } from '~/i18n'

export function EntityAnonymizeActionsMenu({
  busy,
  disabled,
  hasAnonymizedFields,
  onDownload,
  onImport,
  onUpdateExisting,
}: {
  busy: boolean
  disabled: boolean
  hasAnonymizedFields: boolean
  onDownload: () => void
  onImport: (removeExisting: boolean) => void
  onUpdateExisting: () => void
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" disabled={disabled}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <WandSparkles className="h-3.5 w-3.5" />
          )}
          {t('entity.io.anonymizeActions')}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onDownload}>
          <Download />
          {t('entity.io.download')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0">
            <Upload />
            {t('entity.io.importAsNew')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuItem onSelect={() => onImport(false)}>
              <Plus />
              {t('entity.io.importKeepExisting')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={() => onImport(true)}
            >
              <Trash2 />
              {t('entity.io.importReplaceExisting')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          disabled={!hasAnonymizedFields}
          onSelect={onUpdateExisting}
        >
          <ShieldAlert />
          {t('entity.io.anonymizeExisting')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
