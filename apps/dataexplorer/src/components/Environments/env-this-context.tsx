import { createContext, type ReactNode, useContext } from 'react'
import type { EnvTemplateThis } from '~/lib/env/this-context'

const EnvThisContext = createContext<EnvTemplateThis | undefined>(undefined)

/** Provide a live `$this` root for templated field autocomplete within a surface. */
export function EnvThisProvider({
  value,
  children,
}: {
  value: EnvTemplateThis | undefined
  children: ReactNode
}) {
  return <EnvThisContext.Provider value={value}>{children}</EnvThisContext.Provider>
}

export function useEnvThisRoot(): EnvTemplateThis | undefined {
  return useContext(EnvThisContext)
}
