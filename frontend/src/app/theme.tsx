import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme } from '../application/theme'

// index.html reads the same key before the first paint, so there's no flash on load.
const STORAGE_KEY = 'agile-planner.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function storedChoice(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

/** Follows the system until the person picks a theme, then remembers it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Theme | null>(storedChoice)
  const [system, setSystem] = useState<Theme>(systemTheme)
  const theme = choice ?? system

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const update = () => setSystem(media.matches ? 'dark' : 'light')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // Always set the attribute, so tokens and the `dark:` variant agree.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembered, but it still switches.
    }
  }, [theme])

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
