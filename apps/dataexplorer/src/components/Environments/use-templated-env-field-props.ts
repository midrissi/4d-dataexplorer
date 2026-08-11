import type { EnvTemplateSuggestion, EnvWriteTarget } from '@4d/ui'
import { useCallback, useMemo } from 'react'
import { useEnvThisRoot } from '~/components/Environments/env-this-context'
import { useTranslation } from '~/i18n'
import { HELPER_TEMPLATE_DEFS, listAllDynamicEnvVarDefs } from '~/lib/env'
import {
  isThisTemplateKey,
  listThisSuggestionKeys,
  resolveThisPath,
  stringifyThisValue,
  type EnvTemplateThis,
} from '~/lib/env/this-context'
import type { EnvScope, EnvVarLookup } from '~/lib/env/types'
import { getCurrentBaseId } from '~/lib/storage'
import { setEnvVarCurrentValue, useEnvironmentsStore } from '~/store/environments'
import { useTabsStore } from '~/store/tabs'

function isEnvScope(value: string | undefined): value is EnvScope {
  return value === 'global' || value === 'profile' || value === 'base'
}

export type TemplatedEnvFieldOptions = {
  /** Live `$this` root for completions and chip previews (overrides context provider). */
  thisRoot?: EnvTemplateThis
}

/** Shared props for @4d/ui TemplatedTextInput / TemplatedTextarea. */
export function useTemplatedEnvFieldProps(options?: TemplatedEnvFieldOptions) {
  const { t } = useTranslation()
  const contextThis = useEnvThisRoot()
  const thisRoot = options?.thisRoot !== undefined ? options.thisRoot : contextThis
  // Re-render when env data changes so chip lookups / suggestions stay fresh.
  const revision = useEnvironmentsStore((s) => s.revision)

  const openEnvironmentsTab = useTabsStore((s) => s.openEnvironmentsTab)

  const labels = useMemo(
    () => ({
      global: t('environments.scopeGlobal'),
      profile: t('environments.scopeProfile'),
      base: t('environments.scopeBase'),
      dynamic: t('environments.scopeDynamic'),
      context: t('environments.scopeContext'),
    }),
    [t]
  )

  const hasProfileEnv = useEnvironmentsStore((s) => Boolean(s.getLayers().profileEnv))
  const hasBaseEnv = useEnvironmentsStore((s) => Boolean(s.getLayers().baseEnv))

  const resolveVariable = useCallback(
    (key: string): EnvVarLookup => {
      if (isThisTemplateKey(key)) {
        const hit = resolveThisPath(thisRoot, key)
        if (hit.found) {
          const text = stringifyThisValue(hit.value)
          return {
            value: text ?? (hit.value === undefined ? '' : String(hit.value)),
            scope: 'dynamic',
            scopeLabel: labels.context,
            unresolved: text === null,
            dynamic: true,
          }
        }
        return {
          value: '',
          scope: 'dynamic',
          scopeLabel: labels.context,
          unresolved: true,
          dynamic: true,
        }
      }
      return useEnvironmentsStore.getState().lookup(key, labels)
    },
    [labels, thisRoot]
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

    const contextItems: EnvTemplateSuggestion[] = []
    for (const key of listThisSuggestionKeys(thisRoot)) {
      if (seen.has(key)) continue
      seen.add(key)
      const hit = resolveThisPath(thisRoot, key)
      const detail = hit.found ? (stringifyThisValue(hit.value) ?? '…') : 'Call context'
      contextItems.push({
        key,
        detail: detail.length > 48 ? `${detail.slice(0, 45)}…` : detail,
        group: 'context',
      })
    }

    const helperItems: EnvTemplateSuggestion[] = []
    for (const item of HELPER_TEMPLATE_DEFS) {
      if (seen.has(item.key)) continue
      seen.add(item.key)
      helperItems.push({
        key: item.key,
        detail: item.description,
        group: 'dynamic',
      })
    }
    const dynamicItems: EnvTemplateSuggestion[] = []
    for (const item of listAllDynamicEnvVarDefs()) {
      if (seen.has(item.key)) continue
      dynamicItems.push({
        key: item.key,
        detail: item.description,
        group: 'dynamic',
      })
    }
    return [...envItems, ...contextItems, ...helperItems, ...dynamicItems]
  }, [revision, thisRoot])

  const variableGroupLabels = useMemo(
    () => ({
      environment: t('environments.suggestGroupEnvironment'),
      dynamic: t('environments.suggestGroupDynamic'),
      context: t('environments.suggestGroupContext'),
      filter: t('environments.suggestGroupFilter'),
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
