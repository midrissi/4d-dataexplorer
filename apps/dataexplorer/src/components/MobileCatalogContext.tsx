import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { prepareMobileOverlay, registerMobileCatalogCloser } from '~/lib/mobile-overlays'

type MobileCatalogContextValue = {
  catalogOpen: boolean
  openCatalog: () => void
  closeCatalog: () => void
  toggleCatalog: () => void
}

const MobileCatalogContext = createContext<MobileCatalogContextValue | null>(null)

export function MobileCatalogProvider({ children }: { children: ReactNode }) {
  const [catalogOpen, setCatalogOpen] = useState(false)

  const closeCatalog = useCallback(() => setCatalogOpen(false), [])

  useEffect(() => {
    registerMobileCatalogCloser(() => setCatalogOpen(false))
    return () => registerMobileCatalogCloser(null)
  }, [])

  const openCatalog = useCallback(() => {
    prepareMobileOverlay('catalog')
    setCatalogOpen(true)
  }, [])

  const toggleCatalog = useCallback(() => {
    setCatalogOpen((open) => {
      if (!open) prepareMobileOverlay('catalog')
      return !open
    })
  }, [])

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
