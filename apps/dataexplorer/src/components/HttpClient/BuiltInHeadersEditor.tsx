import { Checkbox, cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import type { HttpBuiltInHeader } from '~/lib/http-client'

const SOURCE_BADGE_KEY: Record<HttpBuiltInHeader['source'], string> = {
  connection: 'httpClient.builtInSourceConnection',
  cookie: 'httpClient.builtInSourceCookie',
  'user-agent': 'httpClient.builtInSourceAuto',
  origin: 'httpClient.builtInSourceAuto',
  accept: 'httpClient.builtInSourceAuto',
  host: 'httpClient.builtInSourceAuto',
  'content-length': 'httpClient.builtInSourceAuto',
}

export function BuiltInHeadersEditor({
  headers,
  onEnabledChange,
  onValueChange,
}: {
  headers: HttpBuiltInHeader[]
  onEnabledChange: (headerName: string, enabled: boolean) => void
  onValueChange: (headerName: string, value: string) => void
}) {
  const { t } = useTranslation()
  if (headers.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t('httpClient.builtInHeaders')}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {t('httpClient.builtInHeadersHint')}
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-border/70">
        {headers.map((header) => {
          const displayValue =
            header.value === '' && !header.enabled
              ? t('httpClient.builtInHeaderOmitted')
              : header.value
          const valueForTitle =
            header.editable && (header.enabled || header.overridden) ? header.value : displayValue
          return (
            <div
              key={`${header.source}:${header.key}`}
              className={cn(
                'grid h-6 grid-cols-[2rem_minmax(7rem,0.9fr)_minmax(0,1.4fr)_4.75rem] items-center border-border/60 border-b last:border-b-0',
                !header.enabled && 'opacity-55'
              )}
            >
              <div className="flex h-full items-center justify-center border-border/50 border-r">
                <Checkbox
                  checked={header.enabled}
                  onCheckedChange={(checked) => onEnabledChange(header.key, checked === true)}
                  aria-label={t('httpClient.enableRow')}
                />
              </div>

              <div className="flex min-w-0 items-center gap-1.5 border-border/50 border-r px-2">
                <span
                  className={cn(
                    'min-w-0 truncate font-mono text-xs',
                    header.enabled ? 'text-foreground' : 'text-muted-foreground line-through'
                  )}
                  title={header.key}
                >
                  {header.key}
                </span>
                {header.overridden ? (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
                    {t('httpClient.builtInOverridden')}
                  </span>
                ) : null}
              </div>

              <div className="flex h-full min-w-0 items-center border-border/50 border-r">
                {header.editable ? (
                  <input
                    type="text"
                    value={header.enabled || header.overridden ? header.value : ''}
                    placeholder={displayValue}
                    disabled={!header.enabled && !header.overridden}
                    onChange={(event) => onValueChange(header.key, event.target.value)}
                    title={valueForTitle || undefined}
                    className="h-full w-full min-w-0 truncate bg-transparent px-2 font-mono text-xs outline-none placeholder:truncate placeholder:text-muted-foreground/70 focus-visible:bg-muted/40 disabled:cursor-not-allowed"
                    aria-label={t('httpClient.headerValue')}
                  />
                ) : (
                  <span
                    className="block w-full truncate px-2 font-mono text-muted-foreground text-xs"
                    title={displayValue}
                  >
                    {displayValue}
                  </span>
                )}
              </div>

              <div className="flex h-full items-center justify-center border-border/50 px-1.5">
                <span className="inline-flex h-5 max-w-full items-center truncate rounded bg-muted px-1.5 font-medium text-[10px] text-muted-foreground">
                  {t(SOURCE_BADGE_KEY[header.source])}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
