// Spec 017. Owner: P5. Money, work and time on one shared 0 to 100 scale, so the gap between them is what you see.
// Money and work keep their colors on every chart of the portal (chart-money, chart-work).
import type { Summary } from '@agile/domain'
import { cn } from '../cn'
import { copShort, pct } from './format'

interface Metric {
  name: string
  value: number | null
  fill: string
  note?: string
  over?: boolean
}

function Row({ name, value, fill, note, over }: Metric) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label">{name}</span>
        <span className={cn('text-number tabular-nums', over && 'text-coral')}>{value === null ? 'Sin dato' : pct(value)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${name}: ${value === null ? 'sin dato' : pct(value)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        className="h-[10px] overflow-hidden rounded-pill bg-surface-strong"
      >
        <div className={cn('h-full rounded-pill', over ? 'bg-coral' : fill)} style={{ width: `${width}%` }} />
      </div>
      {note && <span className={cn('text-caption', over ? 'text-coral' : 'text-ink-muted')}>{note}</span>}
    </div>
  )
}

/** The three rows without a card around them, for the portal's hero and for ProgressBars. */
export function Comparison({ summary, contractValue }: { summary: Summary; contractValue?: number }) {
  const overspent = summary.spent_pct > 100
  return (
    <div className="grid gap-4">
      <Row
        name="Dinero usado"
        value={summary.spent_pct}
        fill="bg-chart-money"
        over={overspent}
        note={
          overspent
            ? `${copShort(summary.spent)}, más que el valor del contrato`
            : `${copShort(summary.spent)}${contractValue ? ` de ${copShort(contractValue)}` : ''}`
        }
      />
      <Row
        name="Trabajo hecho"
        value={summary.physical_pct}
        fill="bg-chart-work"
        note={summary.physical_pct === null ? 'Sin actividades planeadas' : 'Según las tareas terminadas en el tablero'}
      />
      <Row name="Tiempo corrido" value={summary.time_pct} fill="bg-ink-subtle" note="Del plazo del contrato" />
    </div>
  )
}
