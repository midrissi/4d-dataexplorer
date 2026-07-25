'use client'

import { type ReactNode, useCallback, useState } from 'react'
import { Button } from '../components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/dialog'

export type ConfirmOptions = {
  title: string
  description: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  icon?: ReactNode
}

type ConfirmState = ConfirmOptions & {
  resolve: (confirmed: boolean) => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    if (state) {
      setIsLoading(true)
      state.resolve(true)
      setState(null)
      setIsLoading(false)
    }
  }, [state])

  const handleCancel = useCallback(() => {
    if (state) {
      state.resolve(false)
      setState(null)
    }
  }, [state])

  const ConfirmDialog = useCallback(() => {
    if (!state) return null

    const {
      title,
      description,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      variant = 'destructive',
      icon,
    } = state

    return (
      <Dialog open={true} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {icon}
              {title}
            </DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel} disabled={isLoading}>
              {cancelText}
            </Button>
            <Button variant={variant} onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? 'Processing...' : confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }, [state, isLoading, handleConfirm, handleCancel])

  return { confirm, ConfirmDialog }
}
