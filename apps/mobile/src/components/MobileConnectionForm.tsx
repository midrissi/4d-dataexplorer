import { Alert, AlertDescription, Button, Input, Label, PasswordInput, Switch } from '@4d/ui'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Wifi,
  XCircle,
} from 'lucide-react'
import { AppearanceControls } from '~/components/AppearanceControls'
import { useTranslation } from '~/i18n'

const PREDEFINED_URLS = ['http://localhost:7080', 'https://localhost:7443']

type MobileConnectionFormProps = {
  editing: boolean
  baseUrl: string
  name: string
  accessKey: string
  username: string
  password: string
  skipSSL: boolean
  readonly: boolean
  timeout: string
  showAdvanced: boolean
  testing: boolean
  submitting: boolean
  testResult: { ok: boolean; message: string } | null
  error: string | null
  onBaseUrlChange: (value: string) => void
  onNameChange: (value: string) => void
  onAccessKeyChange: (value: string) => void
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSkipSSLChange: (value: boolean) => void
  onReadonlyChange: (value: boolean) => void
  onTimeoutChange: (value: string) => void
  onToggleAdvanced: () => void
  onCancel: () => void
  onTest: () => void
  onSave: () => void
  onConnect: () => void
}

export function MobileConnectionForm({
  editing,
  baseUrl,
  name,
  accessKey,
  username,
  password,
  skipSSL,
  readonly,
  timeout,
  showAdvanced,
  testing,
  submitting,
  testResult,
  error,
  onBaseUrlChange,
  onNameChange,
  onAccessKeyChange,
  onUsernameChange,
  onPasswordChange,
  onSkipSSLChange,
  onReadonlyChange,
  onTimeoutChange,
  onToggleAdvanced,
  onCancel,
  onTest,
  onSave,
  onConnect,
}: MobileConnectionFormProps) {
  const { t } = useTranslation()
  const canSubmit = Boolean(baseUrl.trim()) && !submitting

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-border border-b px-3 pt-[max(0.75rem,var(--app-safe-top))] pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={onCancel}
          aria-label={t('connectionScreen.formCancel')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-semibold text-base">
              {editing ? t('connectionScreen.formEditTitle') : t('connectionScreen.formNewTitle')}
            </h1>
            <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 font-medium text-[10px] text-warning uppercase tracking-wide">
              {t('mobile.betaBadge')}
            </span>
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {t('connectionScreen.formNewSubtitle')}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="space-y-2">
          <Label htmlFor="mobile-url">{t('connectionScreen.formUrlLabel')}</Label>
          <Input
            id="mobile-url"
            className="h-11"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="https://192.168.1.10:8080"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="url"
          />
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_URLS.map((url) => (
              <Button
                key={url}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs"
                onClick={() => onBaseUrlChange(url)}
              >
                {url.replace(/^https?:\/\//, '')}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{t('mobile.lanHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile-name">{t('connectionScreen.formNameLabel')}</Label>
          <Input
            id="mobile-name"
            className="h-11"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile-key">{t('connectionScreen.formAccessKeyLabel')}</Label>
          <PasswordInput
            id="mobile-key"
            className="h-11"
            value={accessKey}
            onChange={(e) => onAccessKeyChange(e.target.value)}
            placeholder={t('connectionScreen.formAccessKeyPlaceholder')}
          />
        </div>

        <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium text-sm">{t('connectionScreen.formReadonlyLabel')}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('connectionScreen.formReadonlyHint')}
            </p>
          </div>
          <Switch checked={readonly} onCheckedChange={onReadonlyChange} />
        </div>

        <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium text-sm">{t('connectionScreen.formSkipSsl')}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('connectionScreen.formSkipSslHint')}
            </p>
          </div>
          <Switch checked={skipSSL} onCheckedChange={onSkipSSLChange} />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-between px-1 text-sm"
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
        >
          {t('connectionScreen.formAdvanced')}
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </Button>

        {showAdvanced ? (
          <div className="space-y-4 rounded-xl border border-border p-4">
            <p className="font-medium text-sm">{t('connectionScreen.formBasicAuth')}</p>
            <div className="space-y-2">
              <Label htmlFor="mobile-user">{t('connectionScreen.formUsername')}</Label>
              <Input
                id="mobile-user"
                className="h-11"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-pass">{t('connectionScreen.formPassword')}</Label>
              <PasswordInput
                id="mobile-pass"
                className="h-11"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-timeout">{t('connectionScreen.formTimeout')}</Label>
              <Input
                id="mobile-timeout"
                className="h-11"
                value={timeout}
                onChange={(e) => onTimeoutChange(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
        ) : null}

        {testResult ? (
          <Alert variant={testResult.ok ? 'success' : 'destructive'}>
            {testResult.ok ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4" aria-hidden />
            )}
            <AlertDescription className="text-sm">{testResult.message}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="shrink-0 space-y-2.5 border-border border-t bg-background/95 px-5 pt-3 pb-[var(--app-safe-bottom)] backdrop-blur-sm">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={!canSubmit || testing}
            onClick={onTest}
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Wifi className="mr-2 h-4 w-4" aria-hidden />
            )}
            {t('connectionScreen.formTest')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={!canSubmit}
            onClick={onSave}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {t('connectionScreen.formSave')}
          </Button>
        </div>
        <Button type="button" className="h-12 w-full text-base" disabled={!canSubmit} onClick={onConnect}>
          {submitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="mr-2 h-5 w-5" aria-hidden />
          )}
          {t('connectionScreen.formConnectSave')}
        </Button>
        <AppearanceControls variant="toolbar" side="top" />
      </footer>
    </div>
  )
}
