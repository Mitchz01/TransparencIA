import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Screens load with their route; the first import of a page can take more than the default second.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
  } catch {
    // Storage may be unavailable; tests don't rely on it.
  }
})

// jsdom lacks matchMedia; the theme provider reads the system preference with it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
