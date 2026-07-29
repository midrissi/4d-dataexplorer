'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Toast, type ToastProps, type ToastVariant, ToastViewport } from '../components/toast'

export type ToastInput = {
  id?: string
  title?: ReactNode
  description?: ReactNode
  variant?: ToastVariant
  icon?: ToastProps['icon']
  duration?: number
  closeLabel?: string
}

type ToastRecord = ToastInput & {
  id: string
}

type ToastContextValue = {
  toast: {
    (input: ToastInput): string
    success: (title: ReactNode, options?: Omit<ToastInput, 'title' | 'variant'>) => string
    error: (title: ReactNode, options?: Omit<ToastInput, 'title' | 'variant'>) => string
    warning: (title: ReactNode, options?: Omit<ToastInput, 'title' | 'variant'>) => string
    info: (title: ReactNode, options?: Omit<ToastInput, 'title' | 'variant'>) => string
    dismiss: (id?: string) => void
  }
  toasts: ToastRecord[]
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5000
const ERROR_DURATION = 8000
const MAX_TOASTS = 4

let toastIdSeq = 0
function nextToastId() {
  toastIdSeq += 1
  return `toast-${toastIdSeq}`
}

export function ToastProvider({
  children,
  closeLabel = 'Close',
}: {
  children: ReactNode
  closeLabel?: string
}) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id?: string) => {
    if (!id) {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
      setToasts([])
      return
    }
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((input: ToastInput): string => {
    const id = input.id ?? nextToastId()
    const variant = input.variant ?? 'default'
    const duration =
      input.duration ?? (variant === 'destructive' ? ERROR_DURATION : DEFAULT_DURATION)

    setToasts((prev) => {
      const next = [...prev.filter((item) => item.id !== id), { ...input, id, variant, duration }]
      return next.slice(-MAX_TOASTS)
    })

    const existing = timersRef.current.get(id)
    if (existing) clearTimeout(existing)

    if (duration > 0) {
      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id)
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }, duration)
      )
    }

    return id
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
    }
  }, [])

  const toast = useMemo(() => {
    const base = ((input: ToastInput) => push(input)) as ToastContextValue['toast']
    base.success = (title, options) => push({ ...options, title, variant: 'success' })
    base.error = (title, options) => push({ ...options, title, variant: 'destructive' })
    base.warning = (title, options) => push({ ...options, title, variant: 'warning' })
    base.info = (title, options) => push({ ...options, title, variant: 'default' })
    base.dismiss = dismiss
    return base
  }, [push, dismiss])

  const value = useMemo<ToastContextValue>(() => ({ toast, toasts }), [toast, toasts])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <ToastViewport>
              {toasts.map((item) => (
                <Toast
                  key={item.id}
                  variant={item.variant}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  duration={item.duration}
                  closeLabel={item.closeLabel ?? closeLabel}
                  onClose={() => dismiss(item.id)}
                />
              ))}
            </ToastViewport>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue['toast'] {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx.toast
}
