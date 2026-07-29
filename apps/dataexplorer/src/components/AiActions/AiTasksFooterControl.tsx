import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { AssistantSparklesIcon } from '~/components/AssistantSparklesIcon'
import { MobileDockButton } from '~/components/MobileDockButton'
import { useAssistantLlmConfigured } from '~/hooks/useAssistantLlmConfigured'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { useAiTasksStore, useRunningAiTaskCount } from '~/store/ai-tasks'
import { AiTaskHistoryDialog } from './AiTaskHistory'
import { AiTaskInteractiveHost, usePendingAiInteraction } from './AiTaskInteractiveHost'

/** Footer control + history dialog. Render once in Layout (or MobileAppFooter). */
export function AiTasksFooterControl({ dock = false }: { dock?: boolean }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const configured = useAssistantLlmConfigured()
  const runningCount = useRunningAiTaskCount()
  const pending = usePendingAiInteraction()
  const setHistoryOpen = useAiTasksStore((state) => state.setHistoryOpen)
  const openTask = useAiTasksStore((state) => state.openTask)
  const historyOpen = useAiTasksStore((state) => state.historyOpen)
  const waitingForInput = pending !== null

  if (!configured) return null

  const handleClick = () => {
    if (pending) openTask(pending.taskId)
    else setHistoryOpen(true)
  }

  const ariaLabel = waitingForInput ? t('aiActions.tasksWaiting') : t('aiActions.historyTitle')

  const icon = (
    <span className="relative inline-flex">
      <AssistantSparklesIcon
        className={dock || mobile ? 'h-5 w-5' : 'h-3 w-3'}
        twinkle={waitingForInput || runningCount > 0}
      />
      {(dock || mobile) && (waitingForInput || runningCount > 0) ? (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
            waitingForInput ? 'bg-primary' : 'bg-primary'
          )}
          aria-hidden
        />
      ) : null}
    </span>
  )

  if (dock) {
    return (
      <>
        <MobileDockButton
          label={t('aiActions.tasks')}
          pressed={historyOpen || waitingForInput}
          onClick={handleClick}
          aria-label={ariaLabel}
          className="relative"
        >
          {icon}
        </MobileDockButton>
        <AiTaskInteractiveHost />
        <AiTaskHistoryDialog />
      </>
    )
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={historyOpen || waitingForInput ? 'secondary' : 'ghost'}
              size={mobile ? 'icon' : 'sm'}
              className={cn('relative', mobile ? 'h-11 w-11' : 'h-6 gap-1.5 px-2 text-[11px]')}
              onClick={handleClick}
              aria-label={ariaLabel}
              aria-pressed={historyOpen}
            >
              {icon}
              {!mobile ? <span>{t('aiActions.tasks')}</span> : null}
              {!mobile && waitingForInput ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              ) : !mobile && runningCount > 0 ? (
                <span className="text-primary tabular-nums">{runningCount}</span>
              ) : null}
              {mobile && (waitingForInput || runningCount > 0) ? (
                <span
                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {waitingForInput
              ? t('aiActions.tasksWaiting')
              : runningCount > 0
                ? t('aiActions.tasksRunning', { count: runningCount })
                : t('aiActions.historyTitle')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AiTaskInteractiveHost />
      <AiTaskHistoryDialog />
    </>
  )
}
