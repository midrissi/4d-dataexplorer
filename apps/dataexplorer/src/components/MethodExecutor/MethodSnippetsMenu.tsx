import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Braces } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { MethodJsonSnippet } from './method-json-snippets'

/** Compact icon-only snippets menu for the method JSON / wrapper editors. */
export function MethodSnippetsMenu({
  snippets,
  onApply,
}: {
  snippets: MethodJsonSnippet[]
  onApply: (snippet: MethodJsonSnippet) => void
}) {
  const { t } = useTranslation()
  if (snippets.length === 0) return null

  return (
    <TooltipProvider delayDuration={300}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label={t('methodExecutor.snippets.label')}
              >
                <Braces className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{t('methodExecutor.snippets.label')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-40">
          {snippets.map((snippet) => (
            <DropdownMenuItem
              key={snippet.id}
              className="text-xs"
              onSelect={() => onApply(snippet)}
            >
              {t(`methodExecutor.snippets.${snippet.labelKey}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
