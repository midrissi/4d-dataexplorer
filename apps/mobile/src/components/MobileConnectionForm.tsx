import { Alert, AlertDescription, Button, cn, Input, Label, PasswordInput, Switch } from '@4d/ui'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Wifi,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { AppearanceControls } from '~/components/AppearanceControls'
import { useTranslation } from '~/i18n'
import type { ColorPreset } from '~/store/settings'
import { MobileConnectionAppearance } from './MobileConnectionAppearance'
import { type KeyValueEntry, MobileKeyValueEntries } from './MobileKeyValueEntries'
import { MobileServerUrlField } from './MobileServerUrlField'

type MobileConnectionFormProps = {
  editing: boolean
  baseUrl: string
  recentUrls?: string[]
  name: string
  accessKey: string
  username: string
  password: string
  headers: KeyValueEntry[]
  cookies: KeyValueEntry[]
  icon: string
  color: ColorPreset
  iconScrollNonce: number
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
  onIconChange: (icon: string) => void
  onColorChange: (color: ColorPreset) => void
  onRandomizeAppearance: () => void
  onAddHeader: () => void
  onRemoveHeader: (index: number) => void
  onChangeHeader: (index: number, field: 'key' | 'value', value: string) => void
  onAddCookie: () => void
  onRemoveCookie: (index: number) => void
  onChangeCookie: (index: number, field: 'key' | 'value', value: string) => void
  onToggleAdvanced: () => void
  onCancel: () => void
  onTest: () => void
  onCancelTest: () => void
  onSave: () => void
  onConnect: () => void
}

export function MobileConnectionForm({
  editing,
  baseUrl,
  recentUrls = [],
  name,
  accessKey,
  username,
  password,
  headers,
  cookies,
  icon,
  color,
  iconScrollNonce,
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
  onIconChange,
  onColorChange,
  onRandomizeAppearance,
  onAddHeader,
  onRemoveHeader,
  onChangeHeader,
  onAddCookie,
  onRemoveCookie,
  onChangeCookie,
  onToggleAdvanced,
  onCancel,
  onTest,
  onCancelTest,
  onSave,
  onConnect,
}: MobileConnectionFormProps) {
  const { t } = useTranslation()
  const canSubmit = Boolean(baseUrl.trim()) && !submitting && !testing
  const advancedRef = useRef<HTMLDivElement>(null)
  const shouldScrollToAdvancedRef = useRef(false)

  useEffect(() => {
    if (!showAdvanced || !shouldScrollToAdvancedRef.current) return
    shouldScrollToAdvancedRef.current = false
    const frame = window.requestAnimationFrame(() => {
      advancedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showAdvanced])

  const handleToggleAdvanced = () => {
    if (!showAdvanced) {
      shouldScrollToAdvancedRef.current = true
    }
    onToggleAdvanced()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="relative z-20 flex shrink-0 items-center gap-2 border-border border-b px-3 pt-[max(0.75rem,var(--app-safe-top))] pb-3">
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

      <div className="relative z-0 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
        <MobileServerUrlField
          id="mobile-url"
          value={baseUrl}
          recentUrls={recentUrls}
          onChange={onBaseUrlChange}
        />

        <div className="space-y-2">
          <Label htmlFor="mobile-name">{t('connectionScreen.formNameLabel')}</Label>
          <Input
            id="mobile-name"
            className="h-11 text-base"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile-key">{t('connectionScreen.formAccessKeyLabel')}</Label>
          <PasswordInput
            id="mobile-key"
            className="h-11 text-base"
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
          onClick={handleToggleAdvanced}
          aria-expanded={showAdvanced}
          aria-controls="mobile-connection-advanced"
        >
          {t('connectionScreen.formAdvanced')}
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </Button>

        {showAdvanced ? (
          <div
            id="mobile-connection-advanced"
            ref={advancedRef}
            className={cn(
              'scroll-mt-3 space-y-5 rounded-xl border border-border p-4',
              'fade-in slide-in-from-top-1 animate-in duration-200'
            )}
          >
            <MobileConnectionAppearance
              icon={icon}
              color={color}
              iconScrollNonce={iconScrollNonce}
              onIconChange={onIconChange}
              onColorChange={onColorChange}
              onRandomize={onRandomizeAppearance}
            />

            <div className="space-y-4 border-border border-t pt-4">
              <p className="font-medium text-sm">{t('connectionScreen.formBasicAuth')}</p>
              <div className="space-y-2">
                <Label htmlFor="mobile-user">{t('connectionScreen.formUsername')}</Label>
                <Input
                  id="mobile-user"
                  className="h-11 text-base"
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
                  className="h-11 text-base"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-timeout">{t('connectionScreen.formTimeout')}</Label>
                <Input
                  id="mobile-timeout"
                  className="h-11 text-base"
                  value={timeout}
                  onChange={(e) => onTimeoutChange(e.target.value)}
                  inputMode="numeric"
                  placeholder="30000"
                />
              </div>
            </div>

            <div className="border-border border-t pt-4">
              <MobileKeyValueEntries
                title={t('connectionScreen.formHeaders')}
                hint={t('connectionScreen.formHeadersHint')}
                keyPlaceholder={t('connectionScreen.formHeaderName')}
                valuePlaceholder={t('connectionScreen.formHeaderValue')}
                entries={headers}
                onAdd={onAddHeader}
                onRemove={onRemoveHeader}
                onChange={onChangeHeader}
              />
            </div>

            <div className="border-border border-t pt-4">
              <MobileKeyValueEntries
                title={t('connectionScreen.formCookies')}
                hint={t('connectionScreen.formCookiesHint')}
                keyPlaceholder={t('connectionScreen.formCookieName')}
                valuePlaceholder={t('connectionScreen.formCookieValue')}
                entries={cookies}
                onAdd={onAddCookie}
                onRemove={onRemoveCookie}
                onChange={onChangeCookie}
              />
            </div>
          </div>
        ) : null}
      </div>

      <footer className="relative z-20 shrink-0 space-y-2.5 border-border border-t bg-background px-5 pt-3 pb-(--app-safe-bottom)">
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

        <div className="flex gap-2">
          {testing ? (
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancelTest}>
              <X className="mr-2 h-4 w-4" aria-hidden />
              {t('connectionScreen.formCancelRequest')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={!canSubmit}
              onClick={onTest}
            >
              <Wifi className="mr-2 h-4 w-4" aria-hidden />
              {t('connectionScreen.formTest')}
            </Button>
          )}
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
        <Button
          type="button"
          className="h-12 w-full text-base"
          disabled={!canSubmit}
          onClick={onConnect}
        >
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
