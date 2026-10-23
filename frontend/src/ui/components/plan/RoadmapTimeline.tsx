import type { CSSProperties, ReactNode } from 'react'
import type { PhaseView, Progress, RoadmapView } from '../../../domain/planViews'
import { percentDone } from '../../../domain/planViews'
import { points } from '../../format'
import { Block, Card, cn, Icon, ProgressTrack, Row, Rows, StateLabel, type Hue, type IconGlyph } from '../ds'
import { Alert02Icon, Calendar03Icon, Flag02Icon, Loading03Icon, Tick02Icon } from '../ds/icons'

type PhaseState = { label: string; hue: Hue; icon: IconGlyph }

function phaseState(phase: PhaseView, week: number | null, overdue: boolean): PhaseState | null {
  if (week === null) return null
  const finished = phase.progress.points > 0 && phase.progress.points_done === phase.progress.points
  if (week > phase.end_week || (overdue && week === phase.end_week)) {
    return finished ? { label: 'Terminada', hue: 'teal', icon: Tick02Icon } : { label: 'Atrasada', hue: 'coral', icon: Alert02Icon }
  }
  if (week >= phase.start_week) return { label: 'En curso', hue: 'blue', icon: Loading03Icon }
  return { label: 'Por venir', hue: 'neutral', icon: Calendar03Icon }
}

const weeksText = (p: PhaseView) => (p.start_week === p.end_week ? `Semana ${p.start_week}` : `Semanas ${p.start_week} a ${p.end_week}`)
const progressText = (p: Progress) => (p.points === 0 ? 'Sin tareas' : `${p.points_done} de ${points(p.points)}`)

/** A cell placed by hand: the current-week column spans every row, so nothing can be auto-placed around it. */
function Cell({ row, column, className, children }: { row: number; column: string | number; className?: string; children?: ReactNode }) {
  const style: CSSProperties = { gridRow: row, gridColumn: column }
  return <div style={style} className={className}>{children}</div>
}

/** The sticky name column, so names stay visible while the weeks scroll (spec 012, FR-004). */
const nameCell = 'sticky left-0 z-10 grid min-w-0 content-center gap-0.5 bg-surface pr-4'

/** Phases and epics as bars over the weeks, today as a highlighted column, deliverables as milestones (spec 012). */
export function RoadmapTimeline({ roadmap }: { roadmap: RoadmapView }) {
  const weeks = Math.max(1, ...roadmap.phases.map((p) => p.end_week))
  const week = roadmap.current_week
  const today = week !== null && !roadmap.overdue && week <= weeks ? week : null
  const rows = 1 + roadmap.phases.reduce((n, p) => n + 1 + p.epics.length, 0)
  const milestones = roadmap.phases.filter((p) => p.deliverables.length > 0)
  let row = 1

  return (
    <div className="grid gap-3">
      {week === null ? (
        <Card className="flex items-center gap-3">
          <Icon icon={Calendar03Icon} className="text-ink-muted" />
          <p className="text-body text-ink-muted">El avance y la semana actual aparecen cuando exista el tablero.</p>
        </Card>
      ) : (
        <Card className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-0.5">
            <span className="text-number tabular-nums">Semana {week}</span>
            <span className="text-caption text-ink-muted">De {weeks} planificadas</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-number tabular-nums">{percentDone(roadmap.progress)}%</span>
            <span className="text-caption text-ink-muted">Del trabajo hecho, en puntos</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-number">{roadmap.current_phase ?? 'Ninguna'}</span>
            <span className="text-caption text-ink-muted">{roadmap.overdue ? 'Fase actual, el plan ya terminó' : 'Fase actual'}</span>
          </div>
        </Card>
      )}

      <Card as="article" padding="lg" className="grid gap-6">
        <div className="overflow-x-auto">
          <div
            className="grid gap-x-1 gap-y-2"
            style={{ gridTemplateColumns: `minmax(9.5rem, 15rem) repeat(${weeks}, minmax(2.5rem, 1fr))` }}
          >
            {/* Behind everything else, so the bars paint over it: a column, not a line (design rule 2). */}
            {today !== null && <div aria-hidden="true" style={{ gridRow: `1 / ${rows + 1}`, gridColumn: today + 1 }} className="rounded-sm bg-primary-soft" />}

            <Cell row={1} column={1} className={cn(nameCell, 'text-caption text-ink-muted')}>Semana</Cell>
            {Array.from({ length: weeks }, (_, i) => (
              <Cell
                key={i}
                row={1}
                column={i + 2}
                className={cn('py-1.5 text-center text-caption tabular-nums', i + 1 === today ? 'font-semibold text-primary-soft-ink' : 'text-ink-muted')}
              >
                {i + 1}
                {i + 1 === today && <span className="sr-only">, semana actual</span>}
              </Cell>
            ))}

            {roadmap.phases.map((phase, p) => {
              const state = phaseState(phase, week, roadmap.overdue)
              const span = `${phase.start_week + 1} / ${phase.end_week + 2}`
              const gap = p > 0 ? 'mt-4' : undefined
              const phaseRow = ++row
              return [
                <Cell key={`${phase.name}-name`} row={phaseRow} column={1} className={cn(nameCell, gap)}>
                  <span className="truncate text-label">{phase.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-caption text-ink-muted tabular-nums">
                    {state && <StateLabel hue={state.hue} icon={state.icon}>{state.label}</StateLabel>}
                    {progressText(phase.progress)}
                  </span>
                </Cell>,
                <Cell key={`${phase.name}-bar`} row={phaseRow} column={span} className={cn('flex items-center gap-1.5 px-1', gap)}>
                  <ProgressTrack
                    size="md"
                    value={phase.progress.points_done}
                    max={phase.progress.points}
                    label={`${phase.name}, ${weeksText(phase).toLowerCase()}, ${progressText(phase.progress)} hechos`}
                    className="flex-1"
                  />
                  {phase.deliverables.length > 0 && <Icon icon={Flag02Icon} size={16} className="shrink-0 text-ink-muted" />}
                </Cell>,
                ...phase.epics.map((epic) => {
                  const epicRow = ++row
                  return [
                    <Cell key={`${epic.key}-name`} row={epicRow} column={1} className={cn(nameCell, 'pl-3')}>
                      <span className="flex min-w-0 gap-2 text-caption">
                        <span className="shrink-0 text-key text-ink-muted">{epic.key}</span>
                        <span className="truncate">{epic.title}</span>
                      </span>
                      <span className="text-caption text-ink-muted tabular-nums">{epic.has_tasks ? progressText(epic.progress) : 'Sin tareas'}</span>
                    </Cell>,
                    <Cell key={`${epic.key}-bar`} row={epicRow} column={span} className="flex items-center px-1">
                      <ProgressTrack
                        value={epic.progress.points_done}
                        max={epic.progress.points}
                        label={`${epic.key} ${epic.title}: ${epic.has_tasks ? progressText(epic.progress) : 'sin tareas'}`}
                        className="flex-1"
                      />
                    </Cell>,
                  ]
                }),
              ]
            })}
          </div>
        </div>

        {milestones.length > 0 && (
          <Block title="Hitos">
            <Rows>
              {milestones.map((phase) => (
                <Row
                  key={phase.name}
                  title={
                    <span className="flex items-center gap-2">
                      <Icon icon={Flag02Icon} size={16} className="shrink-0 text-ink-muted" />
                      Semana {phase.end_week}, fin de {phase.name}
                    </span>
                  }
                  detail={phase.deliverables.join(', ')}
                />
              ))}
            </Rows>
          </Block>
        )}
      </Card>
    </div>
  )
}
