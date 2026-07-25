import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { AssistantSparklesIcon } from '~/components/AssistantSparklesIcon'
import { useAssistantLlmConfigured } from '~/hooks/useAssistantLlmConfigured'
import { useTranslation } from '~/i18n'
import { useAiTasksStore, useRunningAiTaskCount } from '~/store/ai-tasks'
import { AiTaskHistoryDialog } from './AiTaskHistory'
import { AiTaskInteractiveHost, usePendingAiInteraction } from './AiTaskInteractiveHost'

/** Footer control + history dialog. Render once in Layout. */
export function AiTasksFooterControl() {
  const { t } = useTranslation()
  const configured = useAssistantLlmConfigured()
  const runningCount = useRunningAiTaskCount()
  const pending = usePendingAiInteraction()
  const setHistoryOpen = useAiTasksStore((state) => state.setHistoryOpen)
  const openTask = useAiTasksStore((state) => state.openTask)
  const historyOpen = useAiTasksStore((state) => state.historyOpen)
  const waitingForInput = pending !== null

  if (!configured) return null

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={historyOpen || waitingForInput ? 'secondary' : 'ghost'}
              size="sm"
              className="relative h-6 gap-1.5 px-2 text-[11px]"
              onClick={() => {
                if (pending) openTask(pending.taskId)
                else setHistoryOpen(true)
              }}
              aria-label={
                waitingForInput ? t('aiActions.tasksWaiting') : t('aiActions.historyTitle')
              }
              aria-pressed={historyOpen}
            >
              {runningCount > 0 && !waitingForInput ? (
                <span className="relative inline-flex">
                  <AssistantSparklesIcon className="h-3 w-3" twinkle />
                </span>
              ) : (
                <span className="relative inline-flex">
                  <AssistantSparklesIcon className="h-3 w-3" twinkle={waitingForInput} />
                  {waitingForInput ? (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px] shadow-background"
                      aria-hidden
                    />
                  ) : null}
                </span>
              )}
              <span>{t('aiActions.tasks')}</span>
              {waitingForInput ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              ) : runningCount > 0 ? (
                <span className="text-primary tabular-nums">{runningCount}</span>
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
