import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Download, FileInput, MoreHorizontal, Shield } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import { mobileMenuContentClass, mobileMenuItemClass } from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'

export function EntitySetActionsMenu({
  target,
  compact = true,
  disabled = false,
  requireEntitySet = true,
  className,
}: {
  target: EntityIoTarget
  compact?: boolean
  disabled?: boolean
  /** When true, export/anonymize need an entity set; import always allowed. */
  requireEntitySet?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const hasSet = Boolean(target.entitySetId?.trim())
  const exportDisabled = requireEntitySet && !hasSet
  const anonymizeDisabled = !hasSet

  const open = (type: 'open-entity-export' | 'open-entity-import' | 'open-entity-anonymize') => {
    eventBus.emit(type, target)
  }

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size={compact ? 'icon' : 'sm'}
                className={cn(compact ? (mobile ? 'h-9 w-9' : 'h-6 w-6') : 'gap-1', className)}
                disabled={disabled}
                aria-label={t('entity.io.actionsMenu')}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                {!compact ? <span>{t('entity.io.actionsMenu')}</span> : null}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('entity.io.actionsMenu')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className={mobile ? mobileMenuContentClass('w-72') : 'w-72'}>
        <DropdownMenuItem
          className={mobile ? mobileMenuItemClass() : undefined}
          disabled={exportDisabled}
          onClick={() => open('open-entity-export')}
        >
          <Download className="h-4 w-4" />
          <span>{t('entity.io.export')}</span>
          {exportDisabled ? (
            <span
              className="ml-auto whitespace-nowrap text-muted-foreground text-xs"
              title={t('entity.deleteManySelectionUnavailable')}
            >
              {t('entity.io.requiresSelection')}
            </span>
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={mobile ? mobileMenuItemClass() : undefined}
          onClick={() => open('open-entity-import')}
        >
          <FileInput className="h-4 w-4" />
          {t('entity.io.import')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={mobile ? mobileMenuItemClass() : undefined}
          disabled={anonymizeDisabled}
          onClick={() => open('open-entity-anonymize')}
        >
          <Shield className="h-4 w-4" />
          <span>{t('entity.io.anonymize')}</span>
          {anonymizeDisabled ? (
            <span
              className="ml-auto whitespace-nowrap text-muted-foreground text-xs"
              title={t('entity.deleteManySelectionUnavailable')}
            >
              {t('entity.io.requiresSelection')}
            </span>
          ) : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
