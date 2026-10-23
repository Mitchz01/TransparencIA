import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Where the current section puts its views (sprints, plan parts) in the top bar. */
export const TopBarViewsSlot = createContext<HTMLElement | null>(null)

/** Renders its children in the center of the project top bar. */
export function TopBarViews({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarViewsSlot)
  return slot ? createPortal(children, slot) : null
}
