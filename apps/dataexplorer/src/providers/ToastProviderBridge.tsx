import { ToastProvider } from '@4d/ui'
import type { ReactNode } from 'react'
import { useTranslation } from '~/i18n'

/** Bridges i18n into ToastProvider so dismiss control is localized. */
export function ToastProviderBridge({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return <ToastProvider closeLabel={t('common.close')}>{children}</ToastProvider>
}
