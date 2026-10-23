// Spec 017. Owner: P5. Activities done and money spent week by week (FR-009), traced to their evidence: the
// chart of how they add up, then each week with what was finished next to the invoices and photos that back it,
// each one with its amount, budget line, the activity it proves and its alerts. Quiet weeks fold into one line.
import type { Expense, ExpenseKind, LineStatus, SprintProgress, WeekEntry } from '@agile/domain'
import { useState } from 'react'
import { Button } from '../Button'
import { cn } from '../cn'
import { Icon } from '../Icon'
import { Pill } from '../Pill'
import { Alert02Icon, File01Icon, Layers01Icon, Target02Icon, Tick02Icon } from '../icons'
import { addDays, cop, daysBetween, shortDay, weekRange } from './format'
import { ProgressChart } from './ProgressChart'

const SHOWN = 6 // weeks with movement before "Ver las N semanas"
const KINDS: Record<ExpenseKind, string> = { invoice: 'Factura', field_photo: 'Foto de campo', report: 'Informe' }

interface WeeklyTimelineProps {
  timeline: WeekEntry[]
  /** Confirmed expenses: each week shows the evidence dated inside it. */
  expenses?: Expense[]
  /** The plan's phases: each week says which one it belongs to. */
  sprints?: SprintProgress[]
  /** Budget lines, to name the line each expense is charged to. */
  lines?: LineStatus[]
  /** The contract's last day: the chart's axis runs to it. */
  end?: string
}

type Row =
  | { kind: 'week'; index: number; week: WeekEntry; evidence: Expense[] }
  | { kind: 'quiet'; from: number; to: number }

export function WeeklyTimeline({ timeline, expenses = [], sprints = [], lines = [], end }: WeeklyTimelineProps) {
  const [all, setAll] = useState(false)
  if (timeline.length === 0) {
    return <p className="text-body text-ink-muted">El contrato todavía no ha empezado.</p>
  }
  const first = timeline[0].week_start
  const totalWeeks = end ? Math.ceil((daysBetween(first, end) + 1) / 7) : timeline.length
  const current = timeline.length - 1
  const evidenceOf = (weekStart: string) => {
    const weekEnd = addDays(weekStart, 6)
    return expenses.filter((expense) => {
      const date = expense.date ?? expense.created_at.slice(0, 10)
      return date >= weekStart && date <= weekEnd
    })
  }
  const rows = foldQuietWeeks(timeline, current, evidenceOf)
  // The limit counts weeks with something to tell; the folded quiet lines between them come along.
  const cut = rows.findIndex((_, i) => rows.slice(0, i + 1).filter((row) => row.kind === 'week').length > SHOWN)
  const shown = all || cut === -1 ? rows : rows.slice(0, cut)
  const phaseOf = (weekStart: string) => sprints.find((sprint) => sprint.end_date && sprint.end_date >= weekStart)?.name
  const lineName = (id: string) => lines.find((line) => line.id === id)?.name ?? id

  return (
    <div className="grid gap-6">
      <ProgressChart timeline={timeline} totalWeeks={totalWeeks} />
      <ol className="grid gap-2" aria-label="Semanas del contrato, la más reciente primero">
        {shown.map((row) =>
          row.kind === 'quiet' ? (
            <li key={`quiet-${row.from}`} className="rounded-md bg-inset px-4 py-3 text-caption text-ink-muted">
              {row.from === row.to
                ? `Semana ${row.from + 1}, ${weekRange(timeline[row.from].week_start)}: sin movimiento.`
                : `Semanas ${row.from + 1} a ${row.to + 1}, del ${shortDay(timeline[row.from].week_start)} al ${shortDay(addDays(timeline[row.to].week_start, 6))}: sin movimiento.`}
            </li>
          ) : (
            <WeekRow
              key={row.week.week_start}
              number={row.index + 1}
              week={row.week}
              current={row.index === current}
              phase={phaseOf(row.week.week_start)}
              evidence={row.evidence}
              lineName={lineName}
            />
          ),
        )}
      </ol>
      {cut !== -1 && (
        <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setAll(!all)}>
          {all ? 'Ver solo las más recientes' : `Ver las ${timeline.length} semanas`}
        </Button>
      )}
    </div>
  )
}

/** Newest first; consecutive weeks with nothing done, spent or reported become one row. The current week always shows. */
function foldQuietWeeks(timeline: WeekEntry[], current: number, evidenceOf: (weekStart: string) => Expense[]): Row[] {
  const rows: Row[] = []
  for (let i = timeline.length - 1; i >= 0; i--) {
    const week = timeline[i]
    const evidence = evidenceOf(week.week_start)
    const quiet = week.spent === 0 && week.tasks_done.length === 0 && evidence.length === 0 && i !== current
    const previous = rows[rows.length - 1]
    if (quiet && previous?.kind === 'quiet' && previous.from === i + 1) previous.from = i
    else if (quiet) rows.push({ kind: 'quiet', from: i, to: i })
    else rows.push({ kind: 'week', index: i, week, evidence })
  }
  return rows
}

interface WeekRowProps {
  number: number
  week: WeekEntry
  current: boolean
  phase?: string
  evidence: Expense[]
  lineName: (id: string) => string
}

function WeekRow({ number, week, current, phase, evidence, lineName }: WeekRowProps) {
  return (
    <li className={cn('grid gap-4 rounded-md p-4 sm:p-5', current ? 'bg-primary-soft' : 'bg-inset')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-label">Semana {number}</span>
          <span className="text-caption text-ink-muted">
            {weekRange(week.week_start)}
            {phase ? `, fase ${phase}` : ''}
          </span>
          {current && <Pill hue="lime">Esta semana</Pill>}
        </span>
        <span className="text-label tabular-nums">{week.spent ? `Se gastaron ${cop(week.spent)}` : <span className="text-ink-muted">Sin gastos</span>}</span>
      </div>

      <div className={cn('grid gap-4', evidence.length > 0 && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
        {week.tasks_done.length > 0 ? (
          <ul className="grid content-start gap-1.5" aria-label="Terminado esta semana">
            {week.tasks_done.map((task) => (
              <li key={task.id} className="flex items-start gap-2 text-body">
                <Icon icon={Tick02Icon} size={20} className="shrink-0 text-teal" />
                {task.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">Sin actividades terminadas.</p>
        )}

        {evidence.length > 0 && (
          <ul className="grid content-start gap-2" aria-label="Evidencias de la semana">
            {evidence.map((expense) => (
              <li key={expense.id}>
                <EvidenceTrace expense={expense} lineName={lineName} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

/** One piece of evidence and what it traces to: the money, the budget line and the activity. Opens the file. */
function EvidenceTrace({ expense, lineName }: { expense: Expense; lineName: (id: string) => string }) {
  const image = expense.mime.startsWith('image/')
  const pending = expense.alerts.filter((alert) => !alert.answer).length
  return (
    <a
      href={expense.file_url}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 rounded-md bg-surface p-3 transition-colors hover:bg-card-hover"
    >
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-sm bg-inset text-ink-muted">
        {image ? <img src={expense.file_url} alt="" loading="lazy" className="size-full object-cover" /> : <Icon icon={File01Icon} size={24} />}
      </span>
      <span className="grid min-w-0 flex-1 content-start gap-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-label tabular-nums">{expense.amount !== null ? cop(expense.amount) : KINDS[expense.kind]}</span>
          <span className="text-caption text-ink-muted">
            {expense.amount !== null ? KINDS[expense.kind] : ''}
            {expense.supplier ? `${expense.amount !== null ? ' de ' : ''}${expense.supplier}` : ''}
          </span>
        </span>
        <span className="line-clamp-2 text-caption">{expense.citizen_summary}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-caption text-ink-muted">
          {expense.budget_line_id && (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Layers01Icon} size={16} />
              {lineName(expense.budget_line_id)}
            </span>
          )}
          {expense.task_title && (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Target02Icon} size={16} />
              {expense.task_title}
            </span>
          )}
        </span>
        {pending > 0 && (
          <Pill hue="amber" icon={Alert02Icon} className="mt-1 justify-self-start">
            {pending === 1 ? 'En revisión' : `${pending} alertas en revisión`}
          </Pill>
        )}
      </span>
    </a>
  )
}
