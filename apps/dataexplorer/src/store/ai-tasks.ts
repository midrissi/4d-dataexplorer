import type { ChatActivityStep } from '@4djs/assistant/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { prepareMobileOverlay } from '~/lib/mobile-overlays'

export type AiTaskKind = 'generate' | 'ask' | 'query'
export type AiTaskStatus = 'running' | 'done' | 'error' | 'cancelled'

export type AiGenerateStyle = 'realistic' | 'edge-cases' | 'minimal'

export type AiGenerateInput = {
  count: number
  prompt: string
  styles: AiGenerateStyle[]
}

export type AiAskInput = {
  prompt: string
}

/** Query-builder generation task (fills filter/params/sort/select via tools). */
export type AiQueryInput = {
  prompt: string
}

/** @deprecated Use AiAskInput — kept for persisted history compatibility */
export type AiSearchInput = AiAskInput

export type AiTaskInput = AiGenerateInput | AiAskInput | AiQueryInput
export type AiTask = {
  id: string
  kind: AiTaskKind
  dataclassName: string
  status: AiTaskStatus
  createdAt: number
  updatedAt: number
  input: AiTaskInput
  content: string
  activity: ChatActivityStep[]
  error?: string
  resultSummary?: string
}

type AiTasksState = {
  tasks: AiTask[]
  historyOpen: boolean
  selectedTaskId: string | null
  setHistoryOpen: (open: boolean) => void
  openTask: (taskId: string) => void
  clearSelectedTask: () => void
  addTask: (task: Omit<AiTask, 'updatedAt'> & { updatedAt?: number }) => void
  updateTask: (id: string, patch: Partial<AiTask>) => void
  appendActivityStart: (
    id: string,
    step: {
      id: string
      name: string
      args: Record<string, unknown>
      callId: string
      thoughtSignature?: string
    }
  ) => void
  finishActivityStep: (
    id: string,
    stepId: string,
    update: { status: 'done' | 'error'; result?: unknown; error?: string }
  ) => void
  setTaskContent: (id: string, content: string) => void
  removeTask: (id: string) => void
  clearTasks: () => void
}

const MAX_TASKS = 30

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createAiTaskId(): string {
  return createId()
}

export const useAiTasksStore = create<AiTasksState>()(
  persist(
    (set) => ({
      tasks: [],
      historyOpen: false,
      selectedTaskId: null,
      setHistoryOpen: (open) => {
        if (open) prepareMobileOverlay('aiHistory')
        set((state) => ({
          historyOpen: open,
          selectedTaskId: open ? state.selectedTaskId : null,
        }))
      },
      openTask: (taskId) => {
        prepareMobileOverlay('aiHistory')
        set({ historyOpen: true, selectedTaskId: taskId })
      },
      clearSelectedTask: () => set({ selectedTaskId: null }),
      addTask: (task) =>
        set((state) => ({
          tasks: [
            {
              ...task,
              updatedAt: task.updatedAt ?? Date.now(),
            },
            ...state.tasks,
          ].slice(0, MAX_TASKS),
        })),
      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...patch, updatedAt: Date.now() } : task
          ),
        })),
      appendActivityStart: (id, step) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  updatedAt: Date.now(),
                  activity: [
                    ...task.activity,
                    {
                      id: step.id,
                      kind: 'tool' as const,
                      name: step.name,
                      args: step.args,
                      callId: step.callId,
                      thoughtSignature: step.thoughtSignature,
                      status: 'active' as const,
                    },
                  ],
                }
              : task
          ),
        })),
      finishActivityStep: (id, stepId, update) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  updatedAt: Date.now(),
                  activity: task.activity.map((step) =>
                    step.id === stepId
                      ? {
                          ...step,
                          status: update.status,
                          result: update.result,
                          error: update.error,
                        }
                      : step
                  ),
                }
              : task
          ),
        })),
      setTaskContent: (id, content) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, content, updatedAt: Date.now() } : task
          ),
        })),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
        })),
      clearTasks: () => set({ tasks: [], selectedTaskId: null }),
    }),
    {
      name: 'dataexplorer-ai-task-history-v1',
      partialize: (state) => ({
        tasks: state.tasks
          .filter((task) => task.status !== 'running')
          .map((task) =>
            task.status === 'running'
              ? task
              : {
                  ...task,
                  // Drop large tool payloads from persisted history
                  activity: task.activity.map((step) => ({
                    ...step,
                    result:
                      step.result === undefined
                        ? undefined
                        : typeof step.result === 'string' && step.result.length > 2000
                          ? `${step.result.slice(0, 2000)}…`
                          : step.result,
                  })),
                }
          )
          .slice(0, MAX_TASKS),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Migrate legacy "search" kind → "ask", and abort mid-flight tasks
        const migrated = state.tasks.map((task) => {
          const kind = (task.kind as string) === 'search' ? ('ask' as const) : task.kind
          if (task.status === 'running') {
            return {
              ...task,
              kind,
              status: 'cancelled' as const,
              error: 'Interrupted when the app closed',
              updatedAt: Date.now(),
            }
          }
          return kind === task.kind ? task : { ...task, kind }
        })
        const changed = migrated.some((task, index) => task !== state.tasks[index])
        if (changed) {
          useAiTasksStore.setState({ tasks: migrated })
        }
      },
    }
  )
)

export function useRunningAiTaskCount(): number {
  return useAiTasksStore((state) => state.tasks.filter((task) => task.status === 'running').length)
}

export function useHasRunningAiTaskForDataclass(dataclassName: string | undefined): boolean {
  return useAiTasksStore((state) =>
    dataclassName
      ? state.tasks.some(
          (task) => task.dataclassName === dataclassName && task.status === 'running'
        )
      : false
  )
}

export function useHasRunningAiQueryTaskForDataclass(dataclassName: string | undefined): boolean {
  return useRunningAiQueryTaskIdForDataclass(dataclassName) != null
}

export function useRunningAiQueryTaskIdForDataclass(
  dataclassName: string | undefined
): string | null {
  return useAiTasksStore((state) => {
    if (!dataclassName) return null
    const task = state.tasks.find(
      (item) =>
        item.dataclassName === dataclassName && item.kind === 'query' && item.status === 'running'
    )
    return task?.id ?? null
  })
}
