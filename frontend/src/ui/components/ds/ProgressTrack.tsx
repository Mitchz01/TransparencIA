import { cn } from './cn'

interface ProgressTrackProps {
  value: number
  max: number
  /** Read by screen readers, e.g. "Checklist 2 of 4". */
  label: string
  over?: boolean
  /** On an `inset` block the track uses `surface`, so it doesn't vanish in the dark theme. */
  inset?: boolean
  /** `sm` is the 6px track; `md` is 12px, for timeline bars. */
  size?: 'sm' | 'md'
  className?: string
}

/** A `primary` fill on a `surface-strong` track; `coral` when it goes over. */
export function ProgressTrack({ value, max, label, over = false, inset = false, size = 'sm', className }: ProgressTrackProps) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(size === 'md' ? 'h-[12px]' : 'h-[6px]', 'overflow-hidden rounded-pill', inset ? 'bg-surface' : 'bg-surface-strong', className)}
    >
      <div className={cn('h-full rounded-pill', over ? 'bg-coral' : 'bg-primary')} style={{ width: `${percent}%` }} />
    </div>
  )
}
