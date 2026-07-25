import type { JsonObject } from '@4d/base64-decoder'
import { ClickToCopy, cn } from '@4d/ui'
import { Braces } from 'lucide-react'
import { useTranslation } from '~/i18n'

export function GenericBinaryView({
  signature,
  data,
  className,
}: {
  signature: string
  data: JsonObject
  className?: string
}) {
  const { t } = useTranslation()
  const json = JSON.stringify(data, null, 2)

  return (
    <div className={cn('overflow-hidden rounded-md border bg-muted/20', className)}>
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Braces className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-xs">{signature}</span>
        <span className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {t('entity.binaryDecodedGeneric')}
        </span>
        <div className="flex-1" />
        <ClickToCopy
          value={json}
          tooltipLabel={t('entity.binaryDecodedCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
        >
          JSON
        </ClickToCopy>
      </div>
      <pre className="max-h-72 overflow-auto p-3 font-mono text-[11px] text-foreground/90 leading-relaxed">
        {json}
      </pre>
    </div>
  )
}
