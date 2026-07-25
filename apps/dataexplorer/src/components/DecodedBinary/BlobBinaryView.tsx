import { HardDrive } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { formatBytes } from '~/lib/utils'
import { ClassShell, Field } from './ClassBinaryShell'
import { PayloadBinaryTabs } from './PayloadBinaryTabs'
import type { BlobDecoded } from './types'

export function BlobBinaryView({ data, className }: { data: BlobDecoded; className?: string }) {
  const { t } = useTranslation()
  return (
    <ClassShell
      icon={HardDrive}
      iconClassName="border-slate-500/30 text-slate-700 dark:text-slate-300"
      title={data.name}
      badges={
        <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 uppercase tracking-wide dark:text-slate-200">
          {formatBytes(data.size)}
        </span>
      }
      className={className}
    >
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={t('entity.binarySize')} value={`${data.size.toLocaleString()} B`} />
        <Field
          label={t('entity.binaryBase64Length')}
          value={data.dataBase64.length.toLocaleString()}
        />
      </dl>
      <PayloadBinaryTabs
        label={t('entity.binaryDecodedData')}
        base64={data.dataBase64}
        fileName={data.name}
      />
    </ClassShell>
  )
}
