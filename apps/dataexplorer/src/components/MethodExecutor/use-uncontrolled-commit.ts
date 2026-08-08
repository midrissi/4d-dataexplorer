import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef } from 'react'
import { handleArgInputTabNavigation, pendingArgumentFlushes } from './arg-input'

/**
 * Uncontrolled text field: no React updates while typing.
 * Commits on blur / unmount / flushPendingArgumentValues().
 */
export function useUncontrolledCommit(value: string, onCommit: (value: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const liveValueRef = useRef(value)
  const committedRef = useRef(value)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit

  useEffect(() => {
    committedRef.current = value
    liveValueRef.current = value
  }, [value])

  const flush = useCallback(() => {
    const el = inputRef.current
    const next = el?.value ?? liveValueRef.current
    liveValueRef.current = next
    if (next === committedRef.current) return
    committedRef.current = next
    onCommitRef.current(next)
  }, [])

  useEffect(() => {
    pendingArgumentFlushes.add(flush)
    return () => {
      pendingArgumentFlushes.delete(flush)
      flush()
    }
  }, [flush])

  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement === el) return
    if (el.value !== value) el.value = value
  }, [value])

  const onInput = useCallback((event: { currentTarget: HTMLInputElement }) => {
    liveValueRef.current = event.currentTarget.value
  }, [])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      handleArgInputTabNavigation(event)
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        flush()
      }
    },
    [flush]
  )

  return { inputRef, flush, onInput, onKeyDown }
}
