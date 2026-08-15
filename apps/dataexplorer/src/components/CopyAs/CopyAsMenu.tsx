import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Check, Code } from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  COPY_AS_FORMATS,
  type CopyAsFormatId,
  type CopyableHttpRequest,
  emitCopyAsSnippet,
  loadCopyAsFormat,
  saveCopyAsFormat,
} from '~/lib/copy-as'
import { isMobileShell } from '~/lib/platform'

export function CopyAsMenu({
  getRequest,
  disabled = false,
  variant = 'ghost',
  triggerClassName,
  iconClassName,
  dataAttr,
}: {
  getRequest: () => CopyableHttpRequest
  disabled?: boolean
  variant?: 'ghost' | 'outline'
  triggerClassName?: string
  iconClassName?: string
  /** e.g. `data-network-copy-as` so parent row clicks ignore this control. */
  dataAttr?: string
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const [lastFormat, setLastFormat] = useState<CopyAsFormatId>(loadCopyAsFormat)

  const stopRowToggle = (event: ReactMouseEvent) => {
    event.stopPropagation()
  }

  const copyFormat = async (format: CopyAsFormatId) => {
    try {
      const snippet = emitCopyAsSnippet(format, getRequest())
      await navigator.clipboard.writeText(snippet)
      setLastFormat(format)
      saveCopyAsFormat(format)
    } catch {
      // Clipboard can throw in locked-down / non-secure contexts.
    }
  }

  const dataProps = dataAttr ? { [dataAttr]: '' } : {}

  return (
    <DropdownMenu modal={false}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={variant}
                size="icon"
                disabled={disabled}
                className={cn(
                  'shrink-0',
                  variant === 'ghost' && 'text-muted-foreground',
                  triggerClassName
                )}
                aria-label={t('copyAs.menu')}
                onClick={stopRowToggle}
                onPointerDown={stopRowToggle}
                {...dataProps}
              >
                <Code className={iconClassName ?? (mobile ? 'h-3.5 w-3.5' : 'h-3 w-3')} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{t('copyAs.menu')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="min-w-52" {...dataProps}>
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {t('copyAs.menu')}
        </DropdownMenuLabel>
        {COPY_AS_FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.id}
            className="gap-2 pl-7"
            onClick={(event) => {
              event.stopPropagation()
              void copyFormat(format.id)
            }}
          >
            {lastFormat === format.id ? (
              <Check className="absolute left-1.5 h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            {t(format.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
