import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { Trash2 } from 'lucide-react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { useConsoleStore } from '~/store/console'

export function ConsoleEntryRemoveButton({ entryId }: { entryId: string }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const remove = useConsoleStore((state) => state.remove)

  const handleClick = (event: ReactMouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    remove(entryId)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-console-remove
            className={cn(
              'shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
              mobile
                ? 'h-8 w-8'
                : 'h-4 w-4 opacity-0 group-focus-within/entry:opacity-100 group-hover/entry:opacity-100'
            )}
            onClick={handleClick}
            aria-label={t('console.removeEntry')}
          >
            <Trash2 className={mobile ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('console.removeEntry')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
