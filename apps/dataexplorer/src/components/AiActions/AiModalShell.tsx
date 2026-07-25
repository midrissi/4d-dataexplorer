import { cn } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import { forwardRef, type ReactNode, useEffect, useImperativeHandle, useRef } from 'react'
import { AssistantSparklesIcon } from '~/components/AssistantSparklesIcon'
import './ai-actions.css'

type AiModalShellProps = {
  icon: LucideIcon
  title: string
  subtitle: ReactNode
  children: ReactNode
  footer: ReactNode
  className?: string
}

/** Shared flat chrome for AI action dialogs. */
export function AiModalShell({
  icon: Icon,
  title,
  subtitle,
  children,
  footer,
  className,
}: AiModalShellProps) {
  return (
    <div className={cn('ai-action-modal', className)}>
      <div className="border-border border-b px-4 pt-3 pr-10 pb-2.5">
        <div className="flex items-start gap-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
            <Icon className="h-4 w-4 text-primary" aria-hidden />
            <AssistantSparklesIcon
              className="absolute -top-1 -right-1 h-3 w-3 text-primary"
              twinkle
            />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="font-semibold text-base tracking-tight">{title}</h2>
            <div className="mt-0.5 text-muted-foreground text-xs leading-snug">{subtitle}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">{children}</div>

      <div className="flex flex-col-reverse items-stretch gap-1.5 border-border border-t bg-muted/30 px-4 py-2 sm:flex-row sm:items-center sm:justify-end">
        {footer}
      </div>
    </div>
  )
}

type AiPromptFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Called when the user presses ⌘/Ctrl+Enter in the textarea. */
  onSubmit?: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  minHeightClass?: string
}

export type AiPromptFieldHandle = {
  focus: () => void
}

export const AiPromptField = forwardRef<AiPromptFieldHandle, AiPromptFieldProps>(
  function AiPromptField(
    {
      id,
      label,
      value,
      onChange,
      onSubmit,
      placeholder,
      disabled,
      autoFocus,
      minHeightClass = 'min-h-[72px]',
    },
    ref
  ) {
    const hasText = value.trim().length > 0
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      focus() {
        const el = textareaRef.current
        if (!el || el.disabled) return
        el.focus()
        const end = el.value.length
        el.setSelectionRange(end, end)
      },
    }))

    useEffect(() => {
      if (!autoFocus || disabled) return
      // Dialog content often steals focus on open; retry briefly so the prompt wins.
      const timers = [0, 50, 120].map((delay) =>
        window.setTimeout(() => {
          const el = textareaRef.current
          if (el && document.activeElement !== el) el.focus()
        }, delay)
      )
      return () => {
        for (const timer of timers) window.clearTimeout(timer)
      }
    }, [autoFocus, disabled])

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="font-medium text-foreground text-xs">
          {label}
        </label>
        <div
          className={cn(
            'ai-action-prompt relative rounded-lg',
            hasText && 'ai-action-prompt--active'
          )}
        >
          <textarea
            ref={textareaRef}
            id={id}
            data-allow-typing=""
            className={cn(
              minHeightClass,
              'nokey w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-snug',
              'placeholder:text-muted-foreground/70',
              'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
              'disabled:cursor-not-allowed disabled:opacity-60'
            )}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                if (!disabled && onSubmit) onSubmit()
                return
              }
              // Let Escape bubble so the parent Dialog can close.
              if (event.key === 'Escape') return
              event.stopPropagation()
            }}
            disabled={disabled}
          />
        </div>
      </div>
    )
  }
)

type AiExampleChipProps = {
  label: string
  icon?: LucideIcon
  selected?: boolean
  disabled?: boolean
  onClick: () => void
}

export function AiExampleChip({
  label,
  icon: Icon,
  selected,
  disabled,
  onClick,
}: AiExampleChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group inline-flex max-w-full items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
        'hover:border-primary/40 hover:bg-primary/10 hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground'
      )}
    >
      {Icon ? <Icon className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> : null}
      <span className="min-w-0 leading-snug">{label}</span>
    </button>
  )
}

export function AiPrimaryButton({
  children,
  disabled,
  loading,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'ai-action-cta inline-flex h-6 items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-xs',
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90',
        'disabled:pointer-events-none disabled:opacity-45'
      )}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
      ) : (
        <AssistantSparklesIcon className="h-3 w-3" twinkle />
      )}
      {children}
    </button>
  )
}
