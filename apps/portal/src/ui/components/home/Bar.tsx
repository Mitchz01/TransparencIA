import { cn } from '@agile/ui'
import { pct } from '@agile/ui/transparency'

interface BarProps {
  name: string
  value: number | null
  fill: string
  /** Fills in once on load, after the bars before it (its place in the group). */
  animate?: number
}

/** One of the portal's three measures, on the shared 0 to 100 scale. Money is chart-1, work chart-2. */
export function Bar({ name, value, fill, animate }: BarProps) {
  const over = value !== null && value > 100
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-3 text-caption">
        <span className="text-ink-muted">{name}</span>
        <span className={cn('tabular-nums', over ? 'text-coral' : 'text-ink')}>{value === null ? 'Sin dato' : pct(value)}</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-pill bg-surface-strong" aria-hidden="true">
        <div
          className={cn('h-full rounded-pill', over ? 'bg-coral' : fill, animate !== undefined && 'fill-in')}
          style={{ width: `${Math.min(100, value ?? 0)}%`, ['--i' as string]: animate }}
        />
      </div>
    </div>
  )
}
