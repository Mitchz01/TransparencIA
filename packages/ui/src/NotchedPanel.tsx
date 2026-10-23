import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'

// A panel with its top right corner cut in, every corner of the cut rounded (two outward, one inward).
// The fill is clipped to that shape, so whatever is behind the panel shows through the cut: a flat
// background, another panel or the dark theme's glow. No borders and no shadow, like any card.

export type NotchTone = 'bg' | 'surface' | 'primary-soft'

const FILL: Record<NotchTone, string> = { bg: 'bg-bg', surface: 'bg-surface', 'primary-soft': 'bg-primary-soft' }

interface NotchedPanelProps {
  tone: NotchTone
  /** Size of the cut, in px. */
  notch: { width: number; height: number }
  /** Radius of the panel's corners and of the cut's curves, in px. */
  radius?: number
  /** Something that sits in the cut, centered (an icon button, the agents' mark, a photo). */
  corner?: ReactNode
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'aside' | 'article'
  'aria-label'?: string
}

/** The panel's outline, clockwise from the top left corner. */
function notchPath(width: number, height: number, notch: { width: number; height: number }, r: number): string {
  const x = width - notch.width // the cut's left wall
  return [
    `M 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    `L ${x - r} 0`,
    `A ${r} ${r} 0 0 1 ${x} ${r}`, // outward, into the cut
    `L ${x} ${notch.height - r}`,
    `A ${r} ${r} 0 0 0 ${x + r} ${notch.height}`, // inward, the cut's bottom left
    `L ${width - r} ${notch.height}`,
    `A ${r} ${r} 0 0 1 ${width} ${notch.height + r}`, // outward, out of the cut
    `L ${width} ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `L ${r} ${height}`,
    `A ${r} ${r} 0 0 1 0 ${height - r}`,
    'Z',
  ].join(' ')
}

export function NotchedPanel({ tone, notch, radius = 24, corner, className, children, as: Tag = 'div', ...rest }: NotchedPanelProps) {
  const ref = useRef<HTMLElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  // The path is in px, so it follows the panel's size; measured before paint, so the cut never flashes.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const clip = size && size.width > 0 ? `path("${notchPath(size.width, size.height, notch, radius)}")` : undefined

  return (
    // The radius on the panel too, so `overflow-hidden` content keeps the rounded corners.
    <Tag ref={ref as never} className={cn('relative isolate', className)} style={{ borderRadius: radius }} {...rest}>
      <span aria-hidden="true" className={cn('absolute inset-0 -z-10', FILL[tone])} style={{ borderRadius: radius, clipPath: clip }} />
      {corner && (
        <span className="absolute top-0 right-0 z-10 flex items-center justify-center" style={{ width: notch.width, height: notch.height }}>
          {corner}
        </span>
      )}
      {children}
    </Tag>
  )
}
