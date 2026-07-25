import type { DataClassMethod, DatastoreMethod } from '@4d/rest'
import { useEffect, useState } from 'react'
import { api } from '~/lib/api'
import { isAssistantExposedMethod } from '~/lib/assistant-exposed-method'
import { eventBus } from '~/lib/eventBus'
import type { MethodScope } from '~/store/method-executor-types'

export type MethodCatalogItem = {
  id: string
  methodName: string
  dataClass?: string
  scope: MethodScope
  applyTo?: string
  paramsText?: string
  allowedOnHTTPGET?: boolean
}

function scopeFromApplyTo(applyTo?: string): MethodScope {
  if (applyTo === 'entity') return 'entity'
  if (
    applyTo === 'entitySelection' ||
    applyTo === 'entityCollection' ||
    applyTo === 'dataClassSelection'
  ) {
    return 'entitySelection'
  }
  return 'dataclass'
}

export function methodItem(method: DataClassMethod, dataClass: string): MethodCatalogItem {
  const scope = scopeFromApplyTo(method.applyTo)
  return {
    id: `${dataClass}:${scope}:${method.name}`,
    methodName: method.name,
    dataClass,
    scope,
    applyTo: method.applyTo,
    paramsText: method.paramsText,
    allowedOnHTTPGET: method.allowedOnHTTPGET,
  }
}

export function catalogMethodItem(method: DatastoreMethod): MethodCatalogItem {
  return {
    id: `catalog:${method.name}`,
    methodName: method.name,
    scope: 'catalog',
    applyTo: method.applyTo,
    paramsText: method.paramsText,
    allowedOnHTTPGET: method.allowedOnHTTPGET,
  }
}

export function useMethodCatalog() {
  const [methods, setMethods] = useState<MethodCatalogItem[]>([])
  const [dataClasses, setDataClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setLoading(true)
      setError(null)
      try {
        const catalog = await api.getCatalog()
        if (cancelled) return
        const fullCatalog = catalog as typeof catalog & { methods?: DatastoreMethod[] }
        const next: MethodCatalogItem[] = []
        for (const dataClass of catalog.dataClasses) {
          for (const method of dataClass.methods ?? []) {
            if (isAssistantExposedMethod(method)) next.push(methodItem(method, dataClass.name))
          }
        }
        for (const method of fullCatalog.methods ?? []) {
          if (isAssistantExposedMethod(method)) next.push(catalogMethodItem(method))
        }
        setMethods(next)
        setDataClasses(catalog.dataClasses.map((dataClass) => dataClass.name))
        setLoading(false)
      } catch (reason: unknown) {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : 'Failed to load methods')
        setLoading(false)
      }
    }

    void loadCatalog()
    const subscription = eventBus.on('catalog-reloaded', () => {
      void loadCatalog()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return { methods, dataClasses, loading, error }
}
