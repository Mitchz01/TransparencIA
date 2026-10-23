import type { CSSProperties, ReactNode } from 'react'
import { cn } from './cn'

// A panel with its top right corner cut in, every corner of the cut rounded (two outward, one inward).
// The cut is painted with the color behind the panel, so the panel needs a flat fill behind it:
// `behind` names that fill. No borders and no shadow, like any card.

export type NotchTone = 'bg' | 'surface' | 'primary-soft'

const FILL: Record<NotchTone, string> = { bg: 'bg-bg', surface: 'bg-surface', 'primary-soft': 'bg-primary-soft' }

interface NotchedPanelProps {
  tone: NotchTone
  behind: NotchTone
  /** Size of the cut, in px. */
  notch: { width: number; height: number }
  /** Radius of the panel's corners and of the cut's curves, in px. */
  radius?: number
  /** Something that sits in the cut, centered (an icon button, the agents' mark). */
  corner?: ReactNode
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'aside' | 'article'
  'aria-label'?: string
}

export function NotchedPanel({ tone, behind, notch, radius = 24, corner, className, children, as: Tag = 'div', ...rest }: NotchedPanelProps) {
  const curve: CSSProperties = {
    width: radius,
    height: radius,
    background: `radial-gradient(circle at 0 100%, transparent ${radius - 0.5}px, var(--${behind}) ${radius}px)`,
  }
  return (
    <Tag className={cn('relative', FILL[tone], className)} style={{ borderRadius: radius }} {...rest}>
      <span aria-hidden="true" className={cn('absolute top-0 right-0', FILL[behind])} style={{ width: notch.width, height: notch.height, borderBottomLeftRadius: radius }} />
      <span aria-hidden="true" className="absolute top-0" style={{ ...curve, right: notch.width }} />
      <span aria-hidden="true" className="absolute right-0" style={{ ...curve, top: notch.height }} />
      {corner && (
        <span className="absolute top-0 right-0 z-10 flex items-center justify-center" style={{ width: notch.width, height: notch.height }}>
          {corner}
        </span>
      )}
      {children}
    </Tag>
  )
}
