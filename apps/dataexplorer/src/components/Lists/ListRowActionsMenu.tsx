import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@4d/ui'
import { Copy, FolderInput, MoreHorizontal } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { PickListScope } from '~/lib/env'

export function ListRowActionsMenu({
  targets,
  onMoveTo,
  onDuplicateTo,
}: {
  targets: { value: PickListScope; label: string }[]
  onMoveTo: (scope: PickListScope) => void
  onDuplicateTo: (scope: PickListScope) => void
}) {
  const { t } = useTranslation()
  if (targets.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label={t('lists.rowActions')}
          title={t('lists.rowActions')}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0">
            <FolderInput />
            {t('lists.moveTo')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {targets.map((target) => (
              <DropdownMenuItem
                key={`move-${target.value}`}
                onSelect={() => onMoveTo(target.value)}
              >
                {target.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0">
            <Copy />
            {t('lists.duplicateTo')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {targets.map((target) => (
              <DropdownMenuItem
                key={`dup-${target.value}`}
                onSelect={() => onDuplicateTo(target.value)}
              >
                {target.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
