// Spec 017. Owner: P5. Money spent and work done, accumulated week by week, against the time the contract runs.
// One 0 to 100 % axis for all three, never two scales. Every value comes from the backend's rules (SC-003):
// the chart only draws them. Money and work keep their colors on every chart of the portal.
import type { WeekEntry } from '@agile/domain'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../cn'
import { addDays, cop, month, pct, weekRange } from './format'

const M = { top: 20, right: 16, bottom: 30, left: 44 }
const LABEL_GAP = 16

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

interface ProgressChartProps {
  timeline: WeekEntry[]
  /** The contract's length in weeks: the x axis runs to its end, so what's left is visible too. */
  totalWeeks: number
}

export function ProgressChart({ timeline, totalWeeks }: ProgressChartProps) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const weeks = Math.max(totalWeeks, timeline.length, 1)
  const last = timeline[timeline.length - 1]
  const height = width >= 640 ? 280 : 220
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = height - M.top - M.bottom
  const top = Math.max(100, Math.ceil(Math.max(...timeline.map((w) => Math.max(w.spent_pct_acc, w.physical_pct_acc))) / 25) * 25)
  const ticks = Array.from({ length: top / 25 + 1 }, (_, i) => i * 25)

  // Week i's values are what was accumulated by its end, so they sit at x(i + 1); x(0) is the start, at 0 %.
  const x = (i: number) => M.left + (i / weeks) * plotW
  const y = (value: number) => M.top + (1 - value / top) * plotH
  const line = (pick: (week: WeekEntry) => number) =>
    [`M${x(0)},${y(0)}`, ...timeline.map((week, i) => `L${x(i + 1)},${y(pick(week))}`)].join(' ')

  const months = Array.from({ length: weeks }, (_, i) => (timeline[0] ? addDays(timeline[0].week_start, i * 7) : ''))
    .map((start, i) => ({ i, start }))
    .filter(({ i, start }, _, all) => start && (i === 0 || month(start) !== month(all[i - 1].start)))

  const today = x(timeline.length)
  const ends = last ? endLabels(y(last.spent_pct_acc), y(last.physical_pct_acc)) : null
  const flip = today > M.left + plotW - 132 // near the contract's end the labels go left of the points
  const hovered = active === null ? null : timeline[active]

  return (
    <figure className="grid gap-4">
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-muted">
        <Legend stroke="stroke-chart-money">Dinero usado</Legend>
        <Legend stroke="stroke-chart-work">Trabajo hecho</Legend>
        <Legend stroke="stroke-ink-subtle" dashed>Tiempo del contrato</Legend>
      </figcaption>
      <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
        <svg
          width={width || undefined}
          height={height}
          role="img"
          aria-label={
            last
              ? `Acumulado a la semana ${timeline.length} de ${weeks}: dinero usado ${pct(last.spent_pct_acc)}, trabajo hecho ${pct(last.physical_pct_acc)}`
              : 'Todavía no hay semanas para mostrar'
          }
          className="block w-full overflow-visible"
        >
          {width > 0 && last && ends && (
            <>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={M.left} x2={M.left + plotW} y1={y(tick)} y2={y(tick)} className="stroke-surface-strong" strokeWidth={1} />
                  <text x={M.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-subtle text-[11px] tabular-nums">
                    {tick} %
                  </text>
                </g>
              ))}
              {months.map(({ i, start }) => (
                <text key={start} x={x(i)} y={height - 8} className="fill-ink-subtle text-[11px]">
                  {month(start)}
                </text>
              ))}

              <line x1={x(0)} y1={y(0)} x2={x(weeks)} y2={y(100)} className="stroke-ink-subtle" strokeWidth={1.5} strokeDasharray="4 4" />
              <line x1={today} x2={today} y1={M.top - 8} y2={M.top + plotH} className="stroke-ink-subtle" strokeWidth={1} />
              <text x={today} y={M.top - 12} textAnchor="middle" className="fill-ink text-[11px] font-semibold">
                Hoy
              </text>

              <path d={line((week) => week.physical_pct_acc)} fill="none" className="stroke-chart-work" strokeWidth={2} strokeLinejoin="round" />
              <path d={line((week) => week.spent_pct_acc)} fill="none" className="stroke-chart-money" strokeWidth={2} strokeLinejoin="round" />
              <circle cx={today} cy={y(last.physical_pct_acc)} r={4.5} className="fill-chart-work stroke-surface" strokeWidth={2} />
              <circle cx={today} cy={y(last.spent_pct_acc)} r={4.5} className="fill-chart-money stroke-surface" strokeWidth={2} />
              <text x={flip ? today - 10 : today + 10} y={ends.work} dy="0.32em" textAnchor={flip ? 'end' : 'start'} className="fill-ink text-[12px] font-semibold tabular-nums">
                Trabajo {pct(last.physical_pct_acc)}
              </text>
              <text x={flip ? today - 10 : today + 10} y={ends.money} dy="0.32em" textAnchor={flip ? 'end' : 'start'} className="fill-ink text-[12px] font-semibold tabular-nums">
                Dinero {pct(last.spent_pct_acc)}
              </text>

              {hovered && active !== null && (
                <g aria-hidden="true">
                  <line x1={x(active + 1)} x2={x(active + 1)} y1={M.top} y2={M.top + plotH} className="stroke-ink" strokeWidth={1} />
                  <circle cx={x(active + 1)} cy={y(hovered.physical_pct_acc)} r={4} className="fill-chart-work stroke-surface" strokeWidth={2} />
                  <circle cx={x(active + 1)} cy={y(hovered.spent_pct_acc)} r={4} className="fill-chart-money stroke-surface" strokeWidth={2} />
                </g>
              )}
              {timeline.map((week, i) => (
                <rect
                  key={week.week_start}
                  x={x(i)}
                  y={M.top}
                  width={Math.max(1, x(i + 1) - x(i))}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              ))}
            </>
          )}
        </svg>
        {hovered && active !== null && (
          <Tooltip left={x(active + 1)} width={width}>
            <span className="text-label">Semana {active + 1}</span>
            <span className="text-caption opacity-80">{weekRange(hovered.week_start)}</span>
            <span className="mt-1 grid gap-0.5 text-caption tabular-nums">
              <span>Dinero usado: {pct(hovered.spent_pct_acc)}</span>
              <span>Trabajo hecho: {pct(hovered.physical_pct_acc)}</span>
              <span>Gastado esa semana: {hovered.spent ? cop(hovered.spent) : 'nada'}</span>
              <span>
                {hovered.tasks_done.length === 0
                  ? 'Sin actividades terminadas'
                  : `${hovered.tasks_done.length} ${hovered.tasks_done.length === 1 ? 'actividad terminada' : 'actividades terminadas'}`}
              </span>
            </span>
          </Tooltip>
        )}
      </div>
    </figure>
  )
}

/** Keeps the two end labels at least LABEL_GAP apart, so they never overlap. */
function endLabels(money: number, work: number) {
  if (Math.abs(money - work) >= LABEL_GAP) return { money, work }
  const middle = (money + work) / 2
  return money >= work ? { money: middle + LABEL_GAP / 2, work: middle - LABEL_GAP / 2 } : { money: middle - LABEL_GAP / 2, work: middle + LABEL_GAP / 2 }
}

function Tooltip({ left, width, children }: { left: number; width: number; children: ReactNode }) {
  const right = left > width - 200
  return (
    <div
      role="presentation"
      className={cn('pointer-events-none absolute top-2 z-10 grid w-52 gap-0.5 rounded-md bg-inverse p-3 text-on-inverse', right && '-translate-x-full')}
      style={{ left: right ? left - 12 : left + 12 }}
    >
      {children}
    </div>
  )
}

function Legend({ stroke, dashed, children }: { stroke: string; dashed?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="18" height="4" aria-hidden="true">
        <line x1={0} x2={18} y1={2} y2={2} className={stroke} strokeWidth={dashed ? 1.5 : 2.5} strokeDasharray={dashed ? '3 3' : undefined} />
      </svg>
      {children}
    </span>
  )
}
