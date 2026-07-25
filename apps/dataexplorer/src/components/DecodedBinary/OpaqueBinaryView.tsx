import { Braces, Mail } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { formatBytes } from '~/lib/utils'
import { ClassShell, Field } from './ClassBinaryShell'
import { PayloadBinaryTabs } from './PayloadBinaryTabs'
import type { OpaqueDecoded } from './types'

export function OpaqueBinaryView({
  signature,
  data,
  className,
}: {
  signature: string
  data: OpaqueDecoded
  className?: string
}) {
  const { t } = useTranslation()
  const payload = data.payloadBase64
  const size = data.payloadSize

  return (
    <ClassShell
      icon={data.name.includes('Mail') || signature === 'MAtt' ? Mail : Braces}
      iconClassName="border-muted-foreground/30 text-muted-foreground"
      title={data.name}
      badges={
        <>
          <span className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
            {signature}
          </span>
          {size != null ? (
            <span className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {formatBytes(size)}
            </span>
          ) : null}
        </>
      }
      className={className}
    >
      {data.notes ? <p className="text-[11px] text-muted-foreground">{data.notes}</p> : null}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {size != null ? (
          <Field label={t('entity.binarySize')} value={`${size.toLocaleString()} B`} />
        ) : null}
        {payload ? (
          <Field label={t('entity.binaryBase64Length')} value={payload.length.toLocaleString()} />
        ) : null}
      </dl>
      {payload ? (
        <PayloadBinaryTabs label={t('entity.binaryDecodedData')} base64={payload} />
      ) : (
        <p className="text-[11px] text-muted-foreground">{t('entity.binaryOpaqueEmpty')}</p>
      )}
    </ClassShell>
  )
}
