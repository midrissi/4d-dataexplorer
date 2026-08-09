import {
  Button,
  cn,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import {
  createLlmSettingsFormState,
  createLlmSettingsFormStateFromStored,
  createLlmSettingsStorage,
  type LlmSettingsFormState,
  maskApiKey,
  testLlmConnection,
  toStoredSettings,
} from '@4djs/assistant/core'
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createDataExplorerLlmSettings } from '~/assistant/llm-config'
import { notifyAssistantLlmConfiguredChanged } from '~/hooks/useAssistantLlmConfigured'
import { useOnlineStatus } from '~/hooks/useOnlineStatus'
import { useTranslation } from '~/i18n'
import { isLocalLlmBaseUrl } from '~/lib/assistant-llm-configured'
import { isMobileShell } from '~/lib/platform'

const LLM_SETTINGS_STORAGE_KEY = 'dataexplorer-llm-settings'

function loadFormState(): LlmSettingsFormState {
  const base = createDataExplorerLlmSettings()
  const storage = createLlmSettingsStorage(LLM_SETTINGS_STORAGE_KEY)
  const stored = storage.load(base)
  const defaultSystemPrompt = base.systemPrompt?.trim() ?? ''
  if (stored) {
    return createLlmSettingsFormStateFromStored(stored, defaultSystemPrompt)
  }
  return createLlmSettingsFormState(base, Boolean(base.apiKey), defaultSystemPrompt)
}

/**
 * Lightweight LLM setup for Settings. Uses @4djs/assistant/core storage only —
 * avoids mounting AssistantProvider (heavy) which can blank the mobile webview.
 */
export function AssistantLlmSettingsPanel() {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const online = useOnlineStatus()
  const [form, setForm] = useState<LlmSettingsFormState | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)

  useEffect(() => {
    try {
      setForm(loadFormState())
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : t('settings.aiLoadFailed'),
      })
    }
  }, [t])

  const updateField = useCallback(
    <K extends keyof LlmSettingsFormState>(key: K, value: LlmSettingsFormState[K]) => {
      setForm((current) => (current ? { ...current, [key]: value } : current))
      setStatus(null)
    },
    []
  )

  const handleTest = useCallback(async () => {
    if (!form) return
    setTesting(true)
    setStatus(null)
    try {
      const apiKey =
        form.apiKey.includes('***') && form.resolvedApiKey
          ? form.resolvedApiKey
          : form.apiKey.trim() || form.resolvedApiKey
      const result = await testLlmConnection({
        baseUrl: form.baseUrl.trim(),
        apiKey: apiKey || null,
        model: form.model.trim(),
      })
      if (result.ok) {
        setStatus({
          kind: 'ok',
          message: t('settings.aiConnected', { model: result.model }),
        })
      } else {
        setStatus({ kind: 'error', message: result.error })
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : t('settings.aiTestFailed'),
      })
    } finally {
      setTesting(false)
    }
  }, [form, t])

  const handleSave = useCallback(async () => {
    if (!form) return
    setSaving(true)
    setStatus(null)
    try {
      const storage = createLlmSettingsStorage(LLM_SETTINGS_STORAGE_KEY)
      const existingKey = form.resolvedApiKey
      storage.save(toStoredSettings(form, existingKey))
      notifyAssistantLlmConfiguredChanged()
      setForm(loadFormState())
      setShowKey(false)
      setStatus({ kind: 'ok', message: t('settings.aiSaved') })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : t('settings.aiSaveFailed'),
      })
    } finally {
      setSaving(false)
    }
  }, [form, t])

  const apiKeyValue =
    form == null
      ? ''
      : showKey && form.resolvedApiKey
        ? form.resolvedApiKey
        : form.apiKey.includes('***')
          ? form.apiKey
          : form.hasStoredApiKey && !form.apiKey && form.resolvedApiKey
            ? maskApiKey(form.resolvedApiKey)
            : form.apiKey

  const testOffline = Boolean(form && !online && !isLocalLlmBaseUrl(form.baseUrl))

  return (
    <div className={cn('rounded-md border border-border bg-card', mobile ? 'p-4' : 'mb-3 p-3')}>
      <div className={cn('flex items-start gap-2.5', mobile ? 'mb-3' : 'mb-2')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground',
            mobile ? 'h-8 w-8' : 'h-6 w-6'
          )}
          aria-hidden
        >
          <Sparkles className={mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        </div>
        <div className="min-w-0 space-y-0.5">
          <h2 className={cn('font-semibold', mobile ? 'text-base' : 'text-sm')}>
            {t('settings.aiSetup')}
          </h2>
          <p className="text-muted-foreground text-xs leading-snug">
            {t('settings.aiSetupDescription')}
          </p>
        </div>
      </div>

      {form == null ? (
        <div className="flex items-center gap-2 py-4 text-muted-foreground text-xs">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('common.loading')}
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">{t('settings.aiBaseUrl')}</Label>
            <Input
              id="ai-base-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={form.baseUrl}
              onChange={(e) => updateField('baseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className={cn(mobile ? 'h-11' : 'h-8', 'font-mono text-xs')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-api-key">{t('settings.aiApiKey')}</Label>
            <div className="flex gap-1.5">
              <Input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={apiKeyValue}
                onChange={(e) => updateField('apiKey', e.target.value)}
                placeholder={
                  form.hasStoredApiKey ? t('settings.aiApiKeyConfiguredPlaceholder') : 'sk-…'
                }
                className={cn(mobile ? 'h-11' : 'h-8', 'min-w-0 flex-1 font-mono text-xs')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(mobile ? 'h-11 w-11' : 'h-8 w-8')}
                onClick={() => {
                  if (!showKey && form.resolvedApiKey && form.apiKey.includes('***')) {
                    updateField('apiKey', form.resolvedApiKey)
                  }
                  setShowKey((v) => !v)
                }}
                aria-label={showKey ? t('settings.aiHideApiKey') : t('settings.aiShowApiKey')}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-model">{t('settings.aiModel')}</Label>
            <Input
              id="ai-model"
              autoComplete="off"
              spellCheck={false}
              value={form.model}
              onChange={(e) => updateField('model', e.target.value)}
              placeholder="gpt-4o-mini"
              list="ai-model-suggestions"
              className={cn(mobile ? 'h-11' : 'h-8', 'font-mono text-xs')}
            />
            {form.modelsText.trim() ? (
              <datalist id="ai-model-suggestions">
                {form.modelsText
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                  .map((model) => (
                    <option key={model} value={model} />
                  ))}
              </datalist>
            ) : null}
          </div>

          {status ? (
            <p
              className={cn('text-xs', status.kind === 'ok' ? 'text-success' : 'text-destructive')}
              role={status.kind === 'error' ? 'alert' : undefined}
            >
              {status.message}
            </p>
          ) : null}

          <div className={cn('flex gap-2', mobile && 'flex-col')}>
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn('inline-flex', mobile && 'w-full')}>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(mobile ? 'h-11 w-full' : 'h-8')}
                      disabled={testing || saving || testOffline}
                      onClick={() => void handleTest()}
                    >
                      {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      {t('settings.aiTestConnection')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {testOffline ? (
                  <TooltipContent>{t('assistant.requiresInternet')}</TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
            <Button
              type="submit"
              className={cn(mobile ? 'h-11 w-full' : 'h-8')}
              disabled={saving || testing}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
