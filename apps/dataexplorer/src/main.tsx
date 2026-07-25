import '@4djs/assistant/styles.css'
import { ensureMonacoJsonSchemaRequest } from '@4d/ui'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import './index.css'
import { Base64DecoderProvider } from './providers/Base64DecoderProvider'
import { ToastProviderBridge } from './providers/ToastProviderBridge'

// Configure Monaco JSON schema loading before any editor mounts (avoids "No schema request service available")
ensureMonacoJsonSchemaRequest()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Base64DecoderProvider>
        <I18nProvider>
          <ToastProviderBridge>
            <App />
          </ToastProviderBridge>
        </I18nProvider>
      </Base64DecoderProvider>
    </Suspense>
  </StrictMode>
)
