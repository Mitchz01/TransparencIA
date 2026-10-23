import { cn } from './cn'

interface ProgressTrackProps {
  value: number
  max: number
  /** Read by screen readers, e.g. "Checklist 2 of 4". */
  label: string
  over?: boolean
  className?: string
}

/** A `primary` fill on a `surface-strong` track; `coral` when it goes over. */
export function ProgressTrack({ value, max, label, over = false, className }: ProgressTrackProps) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-[6px] overflow-hidden rounded-pill bg-surface-strong', className)}
    >
      <div className={cn('h-full rounded-pill', over ? 'bg-coral' : 'bg-primary')} style={{ width: `${percent}%` }} />
    </div>
  )
}
