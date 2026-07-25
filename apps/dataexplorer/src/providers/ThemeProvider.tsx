import { type ThemeName, themes } from '@4d/ui'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import {
  DEFAULT_PROFILE_PREFS,
  getTheme as getStoredTheme,
  getThemeName as getStoredThemeName,
  setTheme as saveTheme,
  setThemeName as saveThemeName,
  subscribeToStorageChanges,
} from '~/lib/storage'

// Theme name context (slate, tangerine, etc.)
interface ThemeNameContextValue {
  themeName: ThemeName
  setThemeName: (theme: ThemeName) => void
  availableThemes: typeof themes
}

const ThemeNameContext = createContext<ThemeNameContextValue | undefined>(undefined)

// Light/dark mode context
type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Theme name (slate, tangerine, etc.) - load from storage
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const stored = getStoredThemeName() as ThemeName
    return stored && stored in themes ? stored : (DEFAULT_PROFILE_PREFS.themeName as ThemeName)
  })

  // Light/dark mode
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme()
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
    return DEFAULT_PROFILE_PREFS.theme
  })

  // Listen for storage changes from other tabs/windows (dataexplorer:profiles)
  useEffect(() => {
    const unsubscribe = subscribeToStorageChanges(() => {
      const newThemeName = getStoredThemeName() as ThemeName
      if (newThemeName && newThemeName in themes) {
        setThemeNameState(newThemeName)
      }
      const newTheme = getStoredTheme()
      if (newTheme === 'light' || newTheme === 'dark') {
        setThemeState(newTheme)
      }
    })
    return unsubscribe
  }, [])

  // Apply theme name
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', themeName)
    saveThemeName(themeName)
  }, [themeName])

  // Apply light/dark mode
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    saveTheme(theme)
  }, [theme])

  const setThemeName = (newTheme: ThemeName) => {
    setThemeNameState(newTheme)
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeNameContext.Provider value={{ themeName, setThemeName, availableThemes: themes }}>
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
        {children}
      </ThemeContext.Provider>
    </ThemeNameContext.Provider>
  )
}

export function useThemeName() {
  const context = useContext(ThemeNameContext)
  if (context === undefined) {
    throw new Error('useThemeName must be used within a ThemeProvider')
  }
  return context
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
