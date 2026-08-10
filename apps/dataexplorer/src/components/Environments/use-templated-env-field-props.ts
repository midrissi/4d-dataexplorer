import type { EnvTemplateSuggestion, EnvWriteTarget } from '@4d/ui'
import { useCallback, useMemo } from 'react'
import { useTranslation } from '~/i18n'
import { DYNAMIC_ENV_VARS } from '~/lib/env/dynamic'
import type { EnvScope } from '~/lib/env/types'
import { getCurrentBaseId } from '~/lib/storage'
import { setEnvVarCurrentValue, useEnvironmentsStore } from '~/store/environments'
import { useTabsStore } from '~/store/tabs'

function isEnvScope(value: string | undefined): value is EnvScope {
  return value === 'global' || value === 'profile' || value === 'base'
}

/** Shared props for @4d/ui TemplatedTextInput / TemplatedTextarea. */
export function useTemplatedEnvFieldProps() {
  const { t } = useTranslation()
  // Re-render when env data changes so chip lookups / suggestions stay fresh.
  const revision = useEnvironmentsStore((s) => s.revision)

  const openEnvironmentsTab = useTabsStore((s) => s.openEnvironmentsTab)

  const labels = useMemo(
    () => ({
      global: t('environments.scopeGlobal'),
      profile: t('environments.scopeProfile'),
      base: t('environments.scopeBase'),
      dynamic: t('environments.scopeDynamic'),
    }),
    [t]
  )

  const hasProfileEnv = useEnvironmentsStore((s) => Boolean(s.getLayers().profileEnv))
  const hasBaseEnv = useEnvironmentsStore((s) => Boolean(s.getLayers().baseEnv))

  const resolveVariable = useCallback(
    (key: string) => useEnvironmentsStore.getState().lookup(key, labels),
    [labels]
  )

  const writeTargets = useMemo((): EnvWriteTarget[] => {
    const hasBase = Boolean(getCurrentBaseId())
    return [
      {
        id: 'global',
        label: labels.global,
      },
      {
        id: 'profile',
        label: labels.profile,
        disabled: !hasProfileEnv,
      },
      {
        id: 'base',
        label: labels.base,
        disabled: !hasBase || !hasBaseEnv,
      },
    ]
  }, [labels, hasProfileEnv, hasBaseEnv])

  const variableSuggestions = useMemo((): EnvTemplateSuggestion[] => {
    void revision
    const map = useEnvironmentsStore.getState().getActiveMap()
    const seen = new Set<string>()
    const envItems: EnvTemplateSuggestion[] = []
    for (const [key, value] of map) {
      if (!key || seen.has(key)) continue
      seen.add(key)
      envItems.push({
        key,
        detail: value,
        group: 'environment',
      })
    }
    envItems.sort((a, b) => a.key.localeCompare(b.key))
    const dynamicItems: EnvTemplateSuggestion[] = []
    for (const item of DYNAMIC_ENV_VARS) {
      if (seen.has(item.key)) continue
      dynamicItems.push({
        key: item.key,
        detail: item.description,
        group: 'dynamic',
      })
    }
    return [...envItems, ...dynamicItems]
  }, [revision])

  const variableGroupLabels = useMemo(
    () => ({
      environment: t('environments.suggestGroupEnvironment'),
      dynamic: t('environments.suggestGroupDynamic'),
    }),
    [t]
  )

  const onVariableChange = useCallback((key: string, value: string, scope?: string) => {
    setEnvVarCurrentValue(key, value, isEnvScope(scope) ? scope : undefined)
  }, [])

  return {
    resolveVariable,
    onVariableChange,
    onManageVariables: openEnvironmentsTab,
    manageVariablesLabel: t('environments.manageVariables'),
    writeTargets,
    addToLabel: t('environments.addTo'),
    unresolvedLabel: t('environments.unresolved'),
    valuePlaceholder: t('environments.enterValue'),
    variableSuggestions,
    variableGroupLabels,
  }
}
