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
import { Database, Filter, type LucideIcon, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { AssistantSparklesIcon } from '~/components/AssistantSparklesIcon'
import { useAssistantLlmConfigured } from '~/hooks/useAssistantLlmConfigured'
import { useTranslation } from '~/i18n'
import { AI_ACTIONS, type AiActionId } from '~/lib/ai-actions'
import {
  useAiTasksStore,
  useHasRunningAiTaskForDataclass,
  useRunningAiQueryTaskIdForDataclass,
} from '~/store/ai-tasks'
import { useReadonlyMode } from '~/store/settings'
import { useActiveDataclassTab, useTabsStore } from '~/store/tabs'
import { AiAskDataclassModal } from './AiAskDataclassModal'
import { AiGenerateDataModal } from './AiGenerateDataModal'
import { AiGenerateQueryModal } from './AiGenerateQueryModal'

export type AiActionsMenuProps = {
  dataclassName: string
  /** Visual size — header uses default, sidebar/graph use icon */
  variant?: 'header' | 'icon'
  className?: string
}

const ACTION_ICONS: Record<AiActionId, LucideIcon> = {
  generate: Database,
  ask: MessageCircle,
  query: Filter,
}

export function AiActionsMenu({
  dataclassName,
  variant = 'header',
  className,
}: AiActionsMenuProps) {
  const { t } = useTranslation()
  const configured = useAssistantLlmConfigured()
  const readonlyMode = useReadonlyMode()
  const hasRunning = useHasRunningAiTaskForDataclass(dataclassName)
  const runningQueryTaskId = useRunningAiQueryTaskIdForDataclass(dataclassName)
  const openAiTask = useAiTasksStore((state) => state.openTask)
  const activeDataclassTab = useActiveDataclassTab()
  const setQueryExpanded = useTabsStore((state) => state.setQueryExpanded)
  const [menuOpen, setMenuOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [queryOpen, setQueryOpen] = useState(false)

  if (!configured || !dataclassName) return null

  const isIcon = variant === 'icon'

  const openAction = (actionId: AiActionId) => {
    setMenuOpen(false)
    // Defer so the menu fully closes before the dialog claims focus (Space / typing).
    requestAnimationFrame(() => {
      if (actionId === 'generate') {
        setGenerateOpen(true)
        return
      }
      if (actionId === 'ask') {
        setAskOpen(true)
        return
      }
      if (runningQueryTaskId) {
        openAiTask(runningQueryTaskId)
        return
      }
      if (
        activeDataclassTab?.dataclassName === dataclassName &&
        !activeDataclassTab.queryExpanded
      ) {
        setQueryExpanded(activeDataclassTab.id, true)
      }
      setQueryOpen(true)
    })
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={isIcon ? 'ghost' : 'outline'}
                  size={isIcon ? 'iconXs' : 'xs'}
                  className={cn(
                    isIcon ? 'h-6! w-6!' : 'h-6 gap-1 border-primary/20 px-2',
                    !isIcon && 'bg-primary/5 hover:border-primary/35 hover:bg-primary/10',
                    hasRunning && 'text-primary',
                    className
                  )}
                  aria-label={t('aiActions.menuAria', { dataclass: dataclassName })}
                  aria-busy={hasRunning || undefined}
                  onClick={(event) => {
                    if (isIcon) event.stopPropagation()
                  }}
                >
                  <span className="relative inline-flex">
                    <AssistantSparklesIcon
                      className={cn(isIcon ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 text-primary')}
                      twinkle={hasRunning || !isIcon}
                    />
                    {hasRunning ? (
                      <span
                        className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  {isIcon ? null : <span>{t('aiActions.menu')}</span>}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              {hasRunning ? t('aiActions.runningForDataclass') : t('aiActions.menu')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" className="w-72 overflow-hidden border-border p-0">
          <div className="border-border border-b px-2.5 py-1.5">
            <DropdownMenuLabel className="p-0 font-semibold text-xs">
              {dataclassName} · {t('aiActions.menu')}
            </DropdownMenuLabel>
          </div>
          <div className="p-1">
            {AI_ACTIONS.map((action) => {
              const disabled = action.mutates && readonlyMode
              const Icon = ACTION_ICONS[action.id]
              return (
                <DropdownMenuItem
                  key={action.id}
                  disabled={disabled}
                  className="gap-2 rounded-md px-2 py-1.5"
                  onSelect={() => openAction(action.id)}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                    <Icon className="h-3 w-3 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-xs">{t(action.labelKey)}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      {t(action.descriptionKey)}
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <AiGenerateDataModal
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        dataclassName={dataclassName}
      />
      <AiAskDataclassModal open={askOpen} onOpenChange={setAskOpen} dataclassName={dataclassName} />
      <AiGenerateQueryModal
        open={queryOpen}
        onOpenChange={setQueryOpen}
        dataclassName={dataclassName}
      />
    </>
  )
}
