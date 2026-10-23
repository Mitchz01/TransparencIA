import type { ReactNode } from 'react'
import { cn } from './cn'

export type ColumnHue = 'neutral' | 'blue' | 'amber' | 'teal'

const TEXT: Record<ColumnHue, string> = {
  neutral: 'text-ink',
  blue: 'text-blue',
  amber: 'text-amber',
  teal: 'text-teal',
}

const LANE: Record<ColumnHue, string> = {
  neutral: 'bg-lane',
  blue: 'bg-lane-blue',
  amber: 'bg-lane-amber',
  teal: 'bg-lane-teal',
}

/** The panel fill of a board column in its hue (spec 014). */
export const laneFill = (hue: ColumnHue) => LANE[hue]

/** A board column's name on a `card` pill with a dot of its hue. The only dot the design system
 *  allows (spec 014): the name is always next to it, so the color never carries the meaning alone. */
export function ColumnLabel({ hue, children, className }: { hue: ColumnHue; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-2 rounded-pill bg-card px-3 text-label whitespace-nowrap', TEXT[hue], className)}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-current" />
      {children}
    </span>
  )
}
