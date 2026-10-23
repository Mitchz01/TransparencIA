import type { ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'

export type Hue = 'teal' | 'blue' | 'amber' | 'coral' | 'violet' | 'lime' | 'neutral'

const SOFT: Record<Hue, string> = {
  teal: 'bg-teal-soft text-teal',
  blue: 'bg-blue-soft text-blue',
  amber: 'bg-amber-soft text-amber',
  coral: 'bg-coral-soft text-coral',
  violet: 'bg-violet-soft text-violet',
  lime: 'bg-primary-soft text-primary-soft-ink',
  neutral: 'bg-surface-strong text-ink-muted',
}

const TEXT: Record<Hue, string> = {
  teal: 'text-teal',
  blue: 'text-blue',
  amber: 'text-amber',
  coral: 'text-coral',
  violet: 'text-violet',
  lime: 'text-accent-ink',
  neutral: 'text-ink-muted',
}

interface PillProps {
  hue: Hue
  icon?: IconGlyph
  children: ReactNode
  className?: string
}

/** A state or a category: a soft fill with an icon and a word. Color never carries meaning alone. */
export function Pill({ hue, icon, children, className }: PillProps) {
  return (
    <span className={cn('inline-flex h-control-sm shrink-0 items-center gap-1.5 rounded-pill px-3 text-label whitespace-nowrap', SOFT[hue], className)}>
      {icon && <Icon icon={icon} size={16} />}
      {children}
    </span>
  )
}

/** The same state without a fill: icon and word in the hue's text color (stepper rows, column warnings). */
export function StateLabel({ hue, icon, children, className, spin }: PillProps & { spin?: boolean }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-label whitespace-nowrap', TEXT[hue], className)}>
      {icon && <Icon icon={icon} size={16} className={spin ? 'animate-spin [animation-duration:2s]' : undefined} />}
      {children}
    </span>
  )
}
