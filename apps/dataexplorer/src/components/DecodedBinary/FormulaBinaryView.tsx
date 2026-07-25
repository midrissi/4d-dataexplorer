import { FileCode2 } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { ClassShell } from './ClassBinaryShell'
import { PayloadBinaryTabs } from './PayloadBinaryTabs'
import type { FormulaDecoded } from './types'

export function FormulaBinaryView({
  data,
  className,
}: {
  data: FormulaDecoded
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <ClassShell
      icon={FileCode2}
      iconClassName="border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
      title={data.name}
      badges={
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-800 uppercase tracking-wide dark:text-emerald-200">
          4fma
        </span>
      }
      className={className}
    >
      <PayloadBinaryTabs label={t('entity.binaryFormulaPayload')} base64={data.formulaBase64} />
    </ClassShell>
  )
}
