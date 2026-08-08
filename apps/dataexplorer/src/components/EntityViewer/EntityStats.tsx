import { useMemo } from 'react'
import { useTranslation } from '~/i18n'
import { countEntityFields } from '~/lib/entity-viewer/stats'

export function EntityStats({ entity }: { entity: Record<string, unknown> }) {
  const { t } = useTranslation()
  const stats = useMemo(() => {
    const { fields, depth } = countEntityFields(entity)
    const jsonSize = JSON.stringify(entity).length

    return { fields, depth, jsonSize }
  }, [entity])

  return (
    <div className="flex items-center gap-4 text-muted-foreground text-xs">
      <span>{t('entity.fieldsCount', { count: stats.fields })}</span>
      <span className="text-border">•</span>
      <span>{t('entity.levelsDeep', { count: stats.depth })}</span>
      <span className="text-border">•</span>
      <span>{t('entity.sizeKb', { size: (stats.jsonSize / 1024).toFixed(1) })}</span>
    </div>
  )
}
