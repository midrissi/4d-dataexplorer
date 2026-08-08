import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { notificationAlertVariant } from './notification-alert-variant'

export function NotificationIcon({ type }: { type?: string }) {
  const variant = notificationAlertVariant(type)
  if (variant === 'warning') return <AlertTriangle aria-hidden />
  if (variant === 'destructive') return <XCircle aria-hidden />
  if (variant === 'success') return <CheckCircle2 aria-hidden />
  return <Info aria-hidden />
}
