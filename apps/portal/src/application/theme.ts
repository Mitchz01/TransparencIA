// Light or dark, like the team app: the system preference by default, then the person's choice.
// app/theme.tsx provides it; the top bar toggles it.

import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error('useTheme needs a ThemeProvider (app/theme.tsx)')
  return state
}
