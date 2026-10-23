import { cn } from './cn'

// Uneven rays around a center, like a spark: the mark of the agents on the sign in screens.
// Angles and lengths are deliberately irregular so it reads as drawn, not as a geometric asterisk.
const RAYS: [angle: number, length: number][] = [
  [-90, 10.6], [-57, 9.1], [-26, 10.8], [8, 8.7], [40, 10.3], [70, 9.4], [103, 10.9], [135, 8.9], [168, 10.2], [200, 9.6], [232, 10.7],
]

const ray = ([angle, length]: [number, number], start: number) => {
  const r = (angle * Math.PI) / 180
  const point = (d: number) => `${(12 + Math.cos(r) * d).toFixed(2)} ${(12 + Math.sin(r) * d).toFixed(2)}`
  return `M${point(start)}L${point(length)}`
}

const SOLID = RAYS.map((r) => ray(r, 1.4)).join('')
const LINE = RAYS.map((r) => ray(r, 0)).join('')

interface AgentSparkProps {
  size?: number
  className?: string
  /** "line": thin rays for a large, quiet drawing behind content. */
  variant?: 'solid' | 'line'
  /** Only when it stands alone and means something; otherwise hidden from screen readers. */
  label?: string
}

/** The agents' mark, in `currentColor`. Brand art, not an icon: icons still come only from Hugeicons. */
export function AgentSpark({ size = 24, className, variant = 'solid', label }: AgentSparkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={variant === 'solid' ? 2.1 : 0.22}
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={variant === 'solid' ? SOLID : LINE} />
    </svg>
  )
}
