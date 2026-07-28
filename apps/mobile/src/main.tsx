import '@4djs/assistant/styles.css'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '~/i18n'
import { Base64DecoderProvider } from '~/providers/Base64DecoderProvider'
import { ToastProviderBridge } from '~/providers/ToastProviderBridge'
import { MobileApp } from './App'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Base64DecoderProvider>
        <I18nProvider>
          <ToastProviderBridge>
            <MobileApp />
          </ToastProviderBridge>
        </I18nProvider>
      </Base64DecoderProvider>
    </Suspense>
  </StrictMode>
)
