import { AssistantRoot } from '@4djs/assistant'
import { useEffect, useMemo } from 'react'
import { useTranslation } from '~/i18n'
import { useDataExplorerStore } from '~/store'
import { createDataExplorerAssistantConfig } from './config'

export function DataExplorerAssistant() {
  const { t, language } = useTranslation()
  const dataclassRevision = useDataExplorerStore((state) =>
    state.dataclasses.map((dc) => dc.name).join('\0')
  )
  const fetchDataclasses = useDataExplorerStore((state) => state.fetchDataclasses)

  // Subscribe to catalog so @mention autocomplete refreshes when dataclasses load.
  useEffect(() => {
    if (dataclassRevision.length > 0) return
    void fetchDataclasses()
  }, [dataclassRevision, fetchDataclasses])

  const config = useMemo(() => {
    // Recreate config when the catalog changes so mention hooks refresh items.
    void dataclassRevision
    return createDataExplorerAssistantConfig(language, t)
  }, [language, t, dataclassRevision])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AssistantRoot config={config} />
    </div>
  )
}
