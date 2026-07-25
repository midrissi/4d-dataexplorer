import { Paperclip } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { formatBytes } from '~/lib/utils'
import { ClassShell, Field } from './ClassBinaryShell'
import { PayloadBinaryTabs } from './PayloadBinaryTabs'
import type { MailAttachmentDecoded } from './types'

export function MailAttachmentBinaryView({
  data,
  className,
}: {
  data: MailAttachmentDecoded
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <ClassShell
      icon={Paperclip}
      iconClassName="border-rose-500/30 text-rose-700 dark:text-rose-300"
      title={data.name || t('entity.binaryMailUntitled')}
      badges={
        <>
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] text-rose-800 uppercase tracking-wide dark:text-rose-200">
            {data.contentType || t('entity.binaryUnknownFormat')}
          </span>
          <span className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {formatBytes(data.dataSize)}
          </span>
        </>
      }
      className={className}
    >
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={t('entity.binaryPath')} value={data.path || t('entity.binaryPathEmpty')} />
        <Field label={t('entity.binaryMailDisposition')} value={data.contentDisposition || '—'} />
        <Field label={t('entity.binaryMailContentId')} value={data.contentId || '—'} />
        <Field label={t('entity.binarySize')} value={`${data.dataSize.toLocaleString()} B`} />
      </dl>
      <PayloadBinaryTabs
        label={t('entity.binaryDecodedData')}
        base64={data.dataBase64}
        contentType={data.contentType}
        fileName={data.name || data.path}
      />
    </ClassShell>
  )
}
