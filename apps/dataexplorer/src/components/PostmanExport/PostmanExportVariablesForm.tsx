import { Checkbox, cn, Input, Label, PasswordInput } from '@4d/ui'
import { KeyRound } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { PostmanExportVariableValues } from '~/lib/postman'

function VariableKeyLabel({ htmlFor, name }: { htmlFor: string; name: string }) {
  return (
    <Label htmlFor={htmlFor} className="inline-flex items-center gap-1">
      <span className="rounded bg-muted/50 px-1 py-px font-mono text-[10px] text-foreground/90">
        {`{{${name}}}`}
      </span>
    </Label>
  )
}

export function PostmanExportVariablesForm({
  variables,
  onVariablesChange,
  includeAccessKeyLogin,
  onIncludeAccessKeyLoginChange,
}: {
  variables: PostmanExportVariableValues
  onVariablesChange: (value: PostmanExportVariableValues) => void
  includeAccessKeyLogin: boolean
  onIncludeAccessKeyLoginChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const hasAccessKey = Boolean(variables.accessKey.trim())

  const setVariable = (key: keyof PostmanExportVariableValues, value: string) => {
    const next = { ...variables, [key]: value }
    onVariablesChange(next)
    if (key === 'accessKey' && !value.trim() && includeAccessKeyLogin) {
      onIncludeAccessKeyLoginChange(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t('postmanExport.variablesSectionHelp')}
      </p>

      <div className="grid gap-1.5 rounded-md bg-muted/20 p-2 sm:grid-cols-2">
        <div className="space-y-0.5 sm:col-span-2">
          <VariableKeyLabel htmlFor="postman-var-baseUrl" name={t('postmanExport.baseUrl')} />
          <Input
            id="postman-var-baseUrl"
            value={variables.baseUrl}
            onChange={(event) => setVariable('baseUrl', event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-0.5 sm:col-span-2">
          <VariableKeyLabel htmlFor="postman-var-accessKey" name={t('postmanExport.accessKey')} />
          <PasswordInput
            id="postman-var-accessKey"
            className="h-7"
            value={variables.accessKey}
            onChange={(event) => setVariable('accessKey', event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-0.5">
          <VariableKeyLabel htmlFor="postman-var-username" name={t('postmanExport.username')} />
          <Input
            id="postman-var-username"
            className="h-7"
            value={variables.username}
            onChange={(event) => setVariable('username', event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-0.5">
          <VariableKeyLabel htmlFor="postman-var-password" name={t('postmanExport.password')} />
          <PasswordInput
            id="postman-var-password"
            className="h-7"
            value={variables.password}
            onChange={(event) => setVariable('password', event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {hasAccessKey ? (
        <div
          className={cn(
            'rounded-md px-2 py-1.5 transition-colors duration-150',
            includeAccessKeyLogin ? 'bg-amber-500/10' : 'bg-muted/20'
          )}
        >
          <div className="flex items-start gap-1.5">
            <div
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm',
                includeAccessKeyLogin
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-muted/40 text-muted-foreground'
              )}
            >
              <KeyRound className="size-3" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              <Checkbox
                id="postman-include-login"
                className="mt-0.5"
                checked={includeAccessKeyLogin}
                onCheckedChange={(value) => onIncludeAccessKeyLoginChange(value === true)}
              />
              <div className="min-w-0 space-y-0.5">
                <label
                  htmlFor="postman-include-login"
                  className="cursor-pointer font-medium text-xs leading-snug"
                >
                  {t('postmanExport.includeAccessKeyLogin')}
                </label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t('postmanExport.includeAccessKeyLoginHelp')}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {t('postmanExport.includeAccessKeyLoginNeedKey')}
        </p>
      )}
    </div>
  )
}
