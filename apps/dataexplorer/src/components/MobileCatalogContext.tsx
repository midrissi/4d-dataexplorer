import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

type MobileCatalogContextValue = {
  catalogOpen: boolean
  openCatalog: () => void
  closeCatalog: () => void
  toggleCatalog: () => void
}

const MobileCatalogContext = createContext<MobileCatalogContextValue | null>(null)

export function MobileCatalogProvider({ children }: { children: ReactNode }) {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const openCatalog = useCallback(() => setCatalogOpen(true), [])
  const closeCatalog = useCallback(() => setCatalogOpen(false), [])
  const toggleCatalog = useCallback(() => setCatalogOpen((v) => !v), [])
  const value = useMemo(
    () => ({ catalogOpen, openCatalog, closeCatalog, toggleCatalog }),
    [catalogOpen, openCatalog, closeCatalog, toggleCatalog]
  )
  return <MobileCatalogContext.Provider value={value}>{children}</MobileCatalogContext.Provider>
}

export function useMobileCatalog(): MobileCatalogContextValue {
  const ctx = useContext(MobileCatalogContext)
  if (!ctx) {
    return {
      catalogOpen: false,
      openCatalog: () => {},
      closeCatalog: () => {},
      toggleCatalog: () => {},
    }
  }
  return ctx
}
