import { Button, cn, useEscapeToDismiss } from '@4d/ui'
import {
  isInteractiveChatTool,
  parseChoicesArgs,
  parseConfirmationArgs,
  REQUEST_CHOICES_TOOL,
  REQUEST_CONFIRMATION_TOOL,
  resolveInteractiveToolResult,
} from '@4djs/assistant/core'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { type AiTask, useAiTasksStore } from '~/store/ai-tasks'

export type PendingAiInteraction = {
  taskId: string
  dataclassName: string
  stepId: string
  callId: string
  toolName: string
  args: Record<string, unknown>
}

export function findPendingAiInteraction(tasks: AiTask[]): PendingAiInteraction | null {
  for (const task of tasks) {
    if (task.status !== 'running') continue
    for (const step of task.activity) {
      if (
        step.status === 'active' &&
        isInteractiveChatTool(step.name) &&
        typeof step.callId === 'string' &&
        step.callId.length > 0
      ) {
        return {
          taskId: task.id,
          dataclassName: task.dataclassName,
          stepId: step.id,
          callId: step.callId,
          toolName: step.name,
          args: step.args,
        }
      }
    }
  }
  return null
}

export function usePendingAiInteraction(): PendingAiInteraction | null {
  // Select the tasks array (stable reference until store updates), then derive.
  // Returning a fresh object from the zustand selector itself causes an infinite loop.
  const tasks = useAiTasksStore((state) => state.tasks)
  return useMemo(() => findPendingAiInteraction(tasks), [tasks])
}

function isDestructiveAction(action?: string): boolean {
  if (!action) return false
  return /\b(delete|remove|disable|destroy|clear|reset|drop|purge|unlink|permanently)\b/i.test(
    action
  )
}

function InteractionShell({
  title,
  icon,
  destructive,
  children,
  footer,
  onDismiss,
}: {
  title: string
  icon: ReactNode
  destructive?: boolean
  children: ReactNode
  footer: ReactNode
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  useEscapeToDismiss(true, onDismiss)

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label={t('common.close')}
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                destructive
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-primary/25 bg-primary/10 text-primary'
              )}
            >
              {icon}
            </span>
            <h2 className="font-semibold text-base tracking-tight">{title}</h2>
          </div>
          <Button type="button" variant="ghost" size="iconXs" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
      </div>
    </div>
  )
}

function AiConfirmationDialog({ pending }: { pending: PendingAiInteraction }) {
  const { t } = useTranslation()
  const args = useMemo(() => parseConfirmationArgs(pending.args), [pending.args])
  const destructive = isDestructiveAction(args.action)

  const resolve = (confirmed: boolean) => {
    resolveInteractiveToolResult(pending.callId, {
      confirmed,
      cancelled: !confirmed,
    })
  }

  return (
    <InteractionShell
      title={destructive ? t('aiActions.confirmDeletion') : t('aiActions.confirmAction')}
      icon={
        destructive ? <AlertTriangle className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />
      }
      destructive={destructive}
      onDismiss={() => resolve(false)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => resolve(false)}>
            {args.cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => resolve(true)}
          >
            {args.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-snug">{args.message}</p>
      {args.action ? (
        <p
          className={cn(
            'rounded-md border px-2.5 py-1.5 font-medium text-xs',
            destructive
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/40 text-muted-foreground'
          )}
        >
          {args.action}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {t('aiActions.confirmContext', { dataclass: pending.dataclassName })}
      </p>
    </InteractionShell>
  )
}

function AiChoicesDialog({ pending }: { pending: PendingAiInteraction }) {
  const { t } = useTranslation()
  const args = useMemo(() => parseChoicesArgs(pending.args), [pending.args])
  const [selected, setSelected] = useState<string[]>([])

  const minOk = selected.length >= args.minSelections
  const maxOk = args.maxSelections === undefined || selected.length <= args.maxSelections

  const cancel = () => {
    resolveInteractiveToolResult(pending.callId, {
      selected: [],
      cancelled: true,
    })
  }

  const submit = () => {
    if (!minOk || !maxOk) return
    resolveInteractiveToolResult(pending.callId, { selected })
  }

  const toggle = (id: string) => {
    if (args.allowMultiple) {
      setSelected((current) => {
        if (current.includes(id)) return current.filter((item) => item !== id)
        if (args.maxSelections !== undefined && current.length >= args.maxSelections) {
          return current
        }
        return [...current, id]
      })
      return
    }
    resolveInteractiveToolResult(pending.callId, { selected: [id] })
  }

  return (
    <InteractionShell
      title={args.allowMultiple ? t('aiActions.chooseOptions') : t('aiActions.chooseOne')}
      icon={<HelpCircle className="h-4 w-4" />}
      onDismiss={cancel}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={cancel}>
            {t('common.cancel')}
          </Button>
          {args.allowMultiple ? (
            <Button type="button" disabled={!minOk || !maxOk} onClick={submit}>
              {args.submitLabel}
              {selected.length > 0 ? ` (${selected.length})` : ''}
            </Button>
          ) : null}
        </>
      }
    >
      <p className="text-sm leading-snug">{args.message}</p>
      <p className="text-muted-foreground text-xs">
        {t('aiActions.confirmContext', { dataclass: pending.dataclassName })}
      </p>
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {args.options.map((option) => {
          const checked = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                checked
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border hover:border-primary/30 hover:bg-muted/40'
              )}
            >
              <div className="font-medium text-sm">{option.label}</div>
              {option.description ? (
                <div className="mt-0.5 text-muted-foreground text-xs">{option.description}</div>
              ) : null}
            </button>
          )
        })}
      </div>
    </InteractionShell>
  )
}

/** Global host for AI-task interactive prompts (confirmation / choices). */
export function AiTaskInteractiveHost() {
  const pending = usePendingAiInteraction()
  const openTask = useAiTasksStore((state) => state.openTask)
  const historyOpen = useAiTasksStore((state) => state.historyOpen)
  const selectedTaskId = useAiTasksStore((state) => state.selectedTaskId)

  const callId = pending?.callId
  const taskId = pending?.taskId

  useEffect(() => {
    if (!taskId || !callId) return
    const { historyOpen: open, selectedTaskId: selected } = useAiTasksStore.getState()
    if (open && selected === taskId) return
    openTask(taskId)
  }, [callId, taskId, openTask])

  if (!pending) return null

  // When the task detail is open, ChatActivity renders the same interactive UI
  // as the assistant Trace — skip the overlay dialog to avoid duplicates.
  if (historyOpen && selectedTaskId === pending.taskId) return null

  try {
    if (pending.toolName === REQUEST_CONFIRMATION_TOOL) {
      return <AiConfirmationDialog pending={pending} />
    }
    if (pending.toolName === REQUEST_CHOICES_TOOL) {
      return <AiChoicesDialog key={pending.callId} pending={pending} />
    }
  } catch {
    return null
  }

  return null
}
