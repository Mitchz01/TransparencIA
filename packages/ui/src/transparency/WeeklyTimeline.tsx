// Spec 017. Owner: P5. Activities done and money spent week by week (FR-009).
import type { WeekEntry } from '@agile/domain'
import { useState, type ReactNode } from 'react'
import { Button } from '../Button'
import { Card } from '../Card'
import { cop, pct, shortDay } from './format'

const RECENT_WEEKS = 4 // weeks with movement; the rest behind a button, so a phone reaches the budget lines fast

const W = 320
const H = 120

/** Two accumulated lines on the same 0 to 100 scale: money spent and physical progress. Plain SVG. */
function Chart({ timeline }: { timeline: WeekEntry[] }) {
  const x = (i: number) => (timeline.length < 2 ? W / 2 : (i / (timeline.length - 1)) * W)
  const y = (value: number) => H - (Math.min(value, 100) / 100) * H
  const path = (pick: (week: WeekEntry) => number) => timeline.map((week, i) => `${i ? 'L' : 'M'}${x(i)},${y(pick(week))}`).join(' ')
  const last = timeline[timeline.length - 1]
  return (
    <figure className="grid gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Acumulado semana a semana: dinero usado ${pct(last.spent_pct_acc)}, trabajo hecho ${pct(last.physical_pct_acc)}`}
        className="h-32 w-full overflow-visible"
      >
        <line x1={0} x2={W} y1={H} y2={H} className="stroke-surface-strong" strokeWidth={1} />
        <path d={path((week) => week.spent_pct_acc)} fill="none" className="stroke-chart-1" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <path d={path((week) => week.physical_pct_acc)} fill="none" className="stroke-chart-2" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-muted">
        <Legend className="stroke-chart-1">Dinero usado {pct(last.spent_pct_acc)}</Legend>
        <Legend className="stroke-chart-2">Trabajo hecho {pct(last.physical_pct_acc)}</Legend>
      </figcaption>
    </figure>
  )
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="16" height="4" aria-hidden="true">
        <line x1={0} x2={16} y1={2} y2={2} className={className} strokeWidth={3} />
      </svg>
      {children}
    </span>
  )
}

export function WeeklyTimeline({ timeline }: { timeline: WeekEntry[] }) {
  const [all, setAll] = useState(false)
  if (timeline.length === 0) return null
  const active = [...timeline].reverse().filter((week) => week.spent > 0 || week.tasks_done.length > 0)
  const quiet = timeline.length - active.length
  const shown = all ? active : active.slice(0, RECENT_WEEKS)
  return (
    <Card className="grid gap-5">
      <Chart timeline={timeline} />
      <ol className="grid gap-2">
        {shown.map((week) => (
          <li key={week.week_start} className="grid gap-1 rounded-md bg-inset p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-label">Semana del {shortDay(week.week_start)}</span>
              <span className="text-caption text-ink-muted tabular-nums">{week.spent ? cop(week.spent) : 'Sin gastos'}</span>
            </div>
            {week.tasks_done.length > 0 ? (
              <ul className="grid gap-0.5 text-caption text-ink">
                {week.tasks_done.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
            ) : (
              <span className="text-caption text-ink-subtle">Sin actividades terminadas</span>
            )}
          </li>
        ))}
      </ol>
      {active.length > RECENT_WEEKS && (
        <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setAll(!all)}>
          {all ? 'Ver solo las últimas' : `Ver las ${active.length} semanas con movimiento`}
        </Button>
      )}
      {quiet > 0 && (
        <p className="text-caption text-ink-muted">
          {active.length === 0
            ? `${quiet === 1 ? 'Una semana' : `${quiet} semanas`} desde el inicio, todavía sin actividades terminadas ni gastos.`
            : `${quiet === 1 ? 'Otra semana' : `Otras ${quiet} semanas`} sin actividades terminadas ni gastos.`}
        </p>
      )}
    </Card>
  )
}
