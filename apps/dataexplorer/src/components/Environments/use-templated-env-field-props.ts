import type { EnvTemplateFilter, EnvTemplateSuggestion, EnvWriteTarget } from '@4d/ui'
import { parseTemplateExpression } from '@4d/ui'
import { useCallback, useMemo } from 'react'
import { useEnvThisRoot } from '~/components/Environments/env-this-context'
import { useTranslation } from '~/i18n'
import {
  HELPER_TEMPLATE_DEFS,
  isHelperTemplateKey,
  listAllDynamicEnvVarDefs,
  resolveEnvTemplates,
} from '~/lib/env'
import {
  type FieldTemplateHint,
  mergeFieldTemplateSuggestions,
} from '~/lib/env/suggest-field-templates'
import {
  type EnvTemplateThis,
  isListsRefKey,
  isThisTemplateKey,
  listListsSuggestionKeys,
  listThisSuggestionKeys,
  parseListsRefName,
  resolveListsRef,
  resolveThisPath,
  stringifyThisValue,
} from '~/lib/env/this-context'
import type { EnvScope, EnvVarLookup } from '~/lib/env/types'
import { getCurrentBaseId } from '~/lib/storage'
import { setEnvVarCurrentValue, useEnvironmentsStore } from '~/store/environments'
import { useTabsStore } from '~/store/tabs'

/** Normalize chip lookup arg to a full `{{…}}` token when possible. */
function toTemplateToken(keyOrExpression: string): string | null {
  const trimmed = keyOrExpression.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) return trimmed
  // Interior with filters (e.g. `$faker…|lower`) — wrap for resolve.
  if (trimmed.includes('|')) return `{{${trimmed}}}`
  return null
}

function isEnvScope(value: string | undefined): value is EnvScope {
  return value === 'global' || value === 'profile' || value === 'base'
}

function isKnownListName(
  name: string | null,
  lists: Record<string, readonly string[]> | undefined,
  listNames: readonly string[] | undefined
): boolean {
  if (!name) return false
  if (lists && Object.hasOwn(lists, name)) return true
  return listNames?.includes(name) ?? false
}

/** `$lists.<name>` from a single-arg `| from:$lists…` helper filter. */
function listsRefNameFromFilters(filters: readonly EnvTemplateFilter[]): string | null {
  const from = filters.find((f) => f.name.toLowerCase() === 'from')
  if (from?.args.length !== 1) return null
  return parseListsRefName(from.args[0] ?? '')
}

export type TemplatedEnvFieldOptions = {
  /** Live `$this` root for completions and chip previews (overrides context provider). */
  thisRoot?: EnvTemplateThis
  /** Named pick-lists with values for `$lists.<name>` resolve / preview. */
  lists?: Record<string, readonly string[]>
  /**
   * Declared pick-list names (may be empty / not loaded yet).
   * Chips that reference `$lists.<name>` stay valid so templates are not painted as typos.
   */
  listNames?: readonly string[]
  /**
   * When set, prepend a “For this field” suggestion group ranked from the
   * attribute name / type (entity forms, typed args, …).
   */
  field?: FieldTemplateHint
}

/** Shared props for @4d/ui TemplatedTextInput / TemplatedTextarea. */
export function useTemplatedEnvFieldProps(options?: TemplatedEnvFieldOptions) {
  const { t } = useTranslation()
  const contextThis = useEnvThisRoot()
  const thisRoot = options?.thisRoot !== undefined ? options.thisRoot : contextThis
  const lists = options?.lists
  const listNames = options?.listNames
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
    (keyOrExpression: string): EnvVarLookup => {
      void revision
      const token = toTemplateToken(keyOrExpression)
      const inner = token ? token.slice(2, -2) : keyOrExpression
      const parsed = parseTemplateExpression(inner)
      const key = parsed?.key ?? keyOrExpression.trim()

      let base: EnvVarLookup
      if (isThisTemplateKey(key)) {
        const hit = resolveThisPath(thisRoot, key)
        if (hit.found) {
          const text = stringifyThisValue(hit.value)
          base = {
            // Path exists in `$this` — templated / cyclic values resolve at send time, not as typos.
            value: text ?? '…',
            scope: 'dynamic',
            scopeLabel: labels.context,
            unresolved: false,
            dynamic: true,
          }
        } else {
          base = {
            value: '',
            scope: 'dynamic',
            scopeLabel: labels.context,
            unresolved: true,
            dynamic: true,
          }
        }
      } else if (isListsRefKey(key)) {
        const name = parseListsRefName(key)
        const hit = resolveListsRef(lists, key)
        if (hit.found) {
          const preview = hit.values.slice(0, 5).join(', ')
          const suffix = hit.values.length > 5 ? `, …(+${hit.values.length - 5})` : ''
          base = {
            value: `${preview}${suffix}`,
            scope: 'dynamic',
            scopeLabel: labels.context,
            unresolved: false,
            dynamic: true,
          }
        } else if (isKnownListName(name, lists, listNames)) {
          // Declared but not loaded yet — still a valid `$lists` ref for chips.
          base = {
            value: '…',
            scope: 'dynamic',
            scopeLabel: labels.context,
            unresolved: false,
            dynamic: true,
          }
        } else {
          base = {
            value: '',
            scope: 'dynamic',
            scopeLabel: labels.context,
            unresolved: true,
            dynamic: true,
          }
        }
      } else {
        base = useEnvironmentsStore.getState().lookup(key, labels)
      }

      // Evaluate the whole expression (dynamic generators + `|` filters) for chip previews.
      if (token) {
        const map = useEnvironmentsStore.getState().getActiveMap()
        const { text, unresolved } = resolveEnvTemplates(token, map, { this: thisRoot, lists })
        if (unresolved.length > 0) {
          // `$this.field` can point at another templated value (`{{$faker…}}`). The path is
          // valid — it resolves at send time — so don't paint the chip as an error typo.
          if ((isThisTemplateKey(key) || isListsRefKey(key)) && !base.unresolved) {
            return {
              ...base,
              value: base.value || '…',
              unresolved: false,
              dynamic: true,
            }
          }
          // `{{$pick | from:$lists.empIds}}` — declared list name is intentional, not a typo.
          const listsName = listsRefNameFromFilters(parsed?.filters ?? [])
          if (isHelperTemplateKey(key) && isKnownListName(listsName, lists, listNames)) {
            return {
              value: '…',
              scope: 'dynamic',
              scopeLabel: labels.context,
              unresolved: false,
              dynamic: true,
            }
          }
          return {
            ...base,
            value: '',
            unresolved: true,
          }
        }
        const hasFilters = (parsed?.filters.length ?? 0) > 0
        return {
          ...base,
          value: text,
          unresolved: false,
          // Filtered results are computed — keep the popover read-only so we don't
          // write a transformed preview back into the underlying env var.
          dynamic: base.dynamic || hasFilters,
        }
      }

      return base
    },
    [labels, thisRoot, lists, listNames, revision]
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
    for (const key of listListsSuggestionKeys(lists)) {
      if (seen.has(key)) continue
      seen.add(key)
      const hit = resolveListsRef(lists, key)
      const detail = hit.found
        ? `${hit.values.length} value${hit.values.length === 1 ? '' : 's'}`
        : 'Pick list'
      contextItems.push({
        key,
        detail,
        group: 'context',
      })
    }
    for (const name of listNames ?? []) {
      const key = `$lists.${name}`
      if (seen.has(key)) continue
      seen.add(key)
      contextItems.push({
        key,
        detail: 'Pick list',
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
    const catalog = [...envItems, ...contextItems, ...helperItems, ...dynamicItems]
    return mergeFieldTemplateSuggestions(catalog, options?.field)
  }, [revision, thisRoot, lists, listNames, options?.field])

  const variableGroupLabels = useMemo(
    () => ({
      field: t('environments.suggestGroupField'),
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
