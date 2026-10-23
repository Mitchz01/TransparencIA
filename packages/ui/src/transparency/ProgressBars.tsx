// Spec 017. Owner: P5. Money, physical progress and time on the same 0 to 100 scale (FR-007).
import type { Summary } from '@agile/domain'
import { Card } from '../Card'
import { ProgressTrack } from '../ProgressTrack'
import { cop, pct } from './format'

function Bar({ name, value, detail, over = false }: { name: string; value: number | null; detail: string; over?: boolean }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-label">{name}</span>
        <span className={over ? 'text-label text-coral' : 'text-label text-ink-muted'}>{detail}</span>
      </div>
      <ProgressTrack value={value ?? 0} max={100} label={`${name}: ${detail}`} over={over} size="md" />
    </div>
  )
}

export function ProgressBars({ summary }: { summary: Summary }) {
  const overspent = summary.spent_pct > 100
  return (
    <Card className="grid gap-5">
      <Bar
        name="Dinero gastado"
        value={summary.spent_pct}
        over={overspent}
        detail={`${pct(summary.spent_pct)}, ${cop(summary.spent)}${overspent ? ', supera el contrato' : ''}`}
      />
      <Bar
        name="Avance de actividades"
        value={summary.physical_pct}
        detail={summary.physical_pct === null ? 'Sin actividades planeadas' : pct(summary.physical_pct)}
      />
      <Bar name="Tiempo transcurrido" value={summary.time_pct} detail={pct(summary.time_pct)} />
    </Card>
  )
}
