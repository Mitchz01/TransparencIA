// Spec 017. Owner: P5. Spent and available per budget line (FR-007).
import type { LineStatus } from '@agile/domain'
import { Card } from '../Card'
import { ProgressTrack } from '../ProgressTrack'
import { cop } from './format'

export function BudgetLines({ lines }: { lines: LineStatus[] }) {
  return (
    <Card className="grid gap-5">
      <h2 className="text-heading">Rubros del presupuesto</h2>
      {lines.map((line) => {
        const over = line.available < 0
        return (
          <div key={line.id} className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-label">{line.name}</span>
              <span className="text-caption text-ink-muted tabular-nums">
                {cop(line.spent)} de {cop(line.amount)}
              </span>
            </div>
            <ProgressTrack value={line.spent} max={line.amount} label={`${line.name}: ${cop(line.spent)} de ${cop(line.amount)}`} over={over} />
            <span className={over ? 'text-caption text-coral' : 'text-caption text-ink-muted'}>
              {over ? `Excedido en ${cop(-line.available)}` : `Disponible ${cop(line.available)}`}
            </span>
          </div>
        )
      })}
    </Card>
  )
}
