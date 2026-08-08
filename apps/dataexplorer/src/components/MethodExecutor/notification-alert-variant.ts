export type NotificationAlertVariant = 'default' | 'destructive' | 'success' | 'warning'

export function notificationAlertVariant(type: string | undefined): NotificationAlertVariant {
  const normalized = type?.trim().toLowerCase()
  if (normalized === 'warning' || normalized === 'warn') return 'warning'
  if (normalized === 'error' || normalized === 'danger' || normalized === 'destructive') {
    return 'destructive'
  }
  if (normalized === 'success' || normalized === 'ok') return 'success'
  return 'default'
}
