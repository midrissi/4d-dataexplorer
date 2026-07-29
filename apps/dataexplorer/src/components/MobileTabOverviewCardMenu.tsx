import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@4d/ui'
import { EllipsisVertical, X } from 'lucide-react'
import { useTranslation } from '~/i18n'
import {
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'

type MobileTabOverviewCardMenuProps = {
  canClose: boolean
  canCloseOthers: boolean
  canCloseAbove: boolean
  canCloseBelow: boolean
  onClose?: () => void
  onCloseOthers: () => void
  onCloseAbove: () => void
  onCloseBelow: () => void
}

export function MobileTabOverviewCardMenu({
  canClose,
  canCloseOthers,
  canCloseAbove,
  canCloseBelow,
  onClose,
  onCloseOthers,
  onCloseAbove,
  onCloseBelow,
}: MobileTabOverviewCardMenuProps) {
  const { t } = useTranslation()
  const hasBulkActions = canCloseOthers || canCloseAbove || canCloseBelow
  if (!canClose && !hasBulkActions) return null

  return (
    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full border border-border/70 bg-background shadow-sm"
            aria-label={t('tabs.tabMenuAria')}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <EllipsisVertical className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={mobileMenuContentClass()}
          {...mobileMenuCollisionProps}
          onClick={(event) => event.stopPropagation()}
        >
          {canClose && onClose ? (
            <DropdownMenuItem className={mobileMenuItemClass()} onSelect={() => onClose()}>
              <X className="h-4 w-4 shrink-0" aria-hidden />
              {t('tabs.closeTab')}
            </DropdownMenuItem>
          ) : null}
          {canClose && onClose && hasBulkActions ? <DropdownMenuSeparator /> : null}
          {canCloseOthers ? (
            <DropdownMenuItem className={mobileMenuItemClass()} onSelect={() => onCloseOthers()}>
              {t('command.closeOtherTabs')}
            </DropdownMenuItem>
          ) : null}
          {canCloseAbove ? (
            <DropdownMenuItem className={mobileMenuItemClass()} onSelect={() => onCloseAbove()}>
              {t('tabs.closeAbove')}
            </DropdownMenuItem>
          ) : null}
          {canCloseBelow ? (
            <DropdownMenuItem className={mobileMenuItemClass()} onSelect={() => onCloseBelow()}>
              {t('tabs.closeBelow')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canClose && onClose ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full border border-border/70 bg-background shadow-sm"
          aria-label={t('tabs.closeTab')}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
