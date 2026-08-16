import type { CodeEditorLabels } from '@4d/ui/editor-prefs'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useSettingsStore } from '~/store/settings'
import { getLabel, type Locale } from './labels'

type TFunction = (key: string, params?: Record<string, string | number>) => string

type I18nContextValue = {
  t: TFunction
  language: Locale
  setLanguage: (locale: Locale) => void
}

const I18N_CONTEXT_KEY = '__dataexplorerI18nContext'

type I18nContextGlobal = typeof globalThis & {
  [I18N_CONTEXT_KEY]?: ReturnType<typeof createContext<I18nContextValue | null>>
}

const i18nContextGlobal = globalThis as I18nContextGlobal
function getI18nContext(): ReturnType<typeof createContext<I18nContextValue | null>> {
  const existingContext = i18nContextGlobal[I18N_CONTEXT_KEY]
  if (existingContext) return existingContext

  const context = createContext<I18nContextValue | null>(null)
  i18nContextGlobal[I18N_CONTEXT_KEY] = context
  return context
}
const I18nContext = getI18nContext()

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSettingsStore((s) => s.language) as Locale
  const setLanguage = useSettingsStore((s) => s.setLanguage)

  const t = useCallback<TFunction>((key, params) => getLabel(language, key, params), [language])

  const value = useMemo<I18nContextValue>(
    () => ({ t, language, setLanguage }),
    [t, language, setLanguage]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider')
  return ctx
}

const EDITOR_LABEL_KEYS: (keyof CodeEditorLabels)[] = [
  'formatDocument',
  'copyCode',
  'copied',
  'undo',
  'redo',
  'zoomIn',
  'zoomOut',
  'resetZoom',
  'enableWordWrap',
  'disableWordWrap',
  'showMinimap',
  'hideMinimap',
  'moveToolbarToTop',
  'moveToolbarToBottom',
]

export function useEditorLabels(): CodeEditorLabels {
  const { t } = useTranslation()
  return useMemo((): CodeEditorLabels => {
    const labels: Partial<CodeEditorLabels> = {}
    for (const key of EDITOR_LABEL_KEYS) {
      labels[key] = t(`editor.${key}`)
    }
    return labels as CodeEditorLabels
  }, [t])
}
