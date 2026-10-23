// Spec 017. Owner: P5. Spent and available per budget line (FR-007).
import type { LineStatus } from '@agile/domain'
import { Card } from '../Card'
import { ProgressTrack } from '../ProgressTrack'
import { cop } from './format'

/** Every line reads the same way: its name, the bar, then what was used and what's left. */
export function BudgetLines({ lines }: { lines: LineStatus[] }) {
  return (
    <Card className="grid gap-5">
      {lines.map((line) => {
        const over = line.available < 0
        return (
          <div key={line.id} className="grid gap-2">
            <span className="text-label">{line.name}</span>
            <ProgressTrack value={line.spent} max={line.amount} label={`${line.name}: ${cop(line.spent)} de ${cop(line.amount)}`} over={over} />
            <div className="flex flex-wrap justify-between gap-x-3 text-caption tabular-nums">
              <span className="text-ink-muted">
                Usado {cop(line.spent)} de {cop(line.amount)}
              </span>
              <span className={over ? 'text-coral' : 'text-ink-muted'}>
                {over ? `Excedido en ${cop(-line.available)}` : `Quedan ${cop(line.available)}`}
              </span>
            </div>
          </div>
        )
      })}
    </Card>
  )
}
