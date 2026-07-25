import { Crosshair } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { ClassShell, Field } from './ClassBinaryShell'
import type { PointerDecoded } from './types'

export function PointerBinaryView({
  data,
  className,
}: {
  data: PointerDecoded
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <ClassShell
      icon={Crosshair}
      iconClassName="border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
      title={data.name}
      badges={
        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-800 uppercase tracking-wide dark:text-indigo-200">
          {data.kind}
        </span>
      }
      className={className}
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label={t('entity.binaryPointerKind')} value={data.kind} />
        <Field label={t('entity.binaryPointerKindCode')} value={String(data.kindCode)} />
        <Field label={t('entity.binaryPointerFileNo')} value={String(data.fileNo)} />
        <Field label={t('entity.binaryPointerFieldNo')} value={String(data.fieldNo)} />
      </dl>
      {data.remainingBytes != null && data.remainingBytes > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t('entity.binaryPointerRemaining', { count: data.remainingBytes })}
        </p>
      ) : null}
    </ClassShell>
  )
}
