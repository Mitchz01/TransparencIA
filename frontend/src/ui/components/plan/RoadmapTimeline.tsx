import type { PhaseView, Progress, RoadmapView } from '../../../domain/planViews'
import { percentDone } from '../../../domain/planViews'
import { points } from '../../format'
import { Card, cn, Icon, Pill, ProgressTrack, Row, Rows, type Hue, type IconGlyph } from '../ds'
import { Alert02Icon, Calendar03Icon, Loading03Icon, Tick02Icon } from '../ds/icons'

type PhaseState = { label: string; hue: Hue; icon?: IconGlyph }

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

/** The phase's place in the project's weeks: filled cells for its weeks, `primary` for the current one. No lines. */
function WeekStrip({ phase, weeks, current }: { phase: PhaseView; weeks: number; current: number | null }) {
  const label = `${weeksText(phase)} de ${weeks}${current ? `, esta es la semana ${current}` : ''}`
  return (
    <div role="img" aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
      {Array.from({ length: weeks }, (_, i) => {
        const week = i + 1
        const inPhase = week >= phase.start_week && week <= phase.end_week
        return (
          <span
            key={week}
            className={cn('h-3 rounded-[4px]', week === current ? (inPhase ? 'bg-primary' : 'bg-primary-soft') : inPhase ? 'bg-ink-subtle/45' : 'bg-inset')}
          />
        )
      })}
    </div>
  )
}

/** Phases across the weeks, epics inside with their progress, and where the team is today (spec 004). */
export function RoadmapTimeline({ roadmap }: { roadmap: RoadmapView }) {
  const weeks = Math.max(1, ...roadmap.phases.map((p) => p.end_week))
  const week = roadmap.current_week
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

      <ol className="grid gap-3">
        {roadmap.phases.map((phase) => {
          const state = phaseState(phase, week, roadmap.overdue)
          return (
            <li key={phase.name}>
              <Card as="article" className="grid gap-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-0.5">
                    <h2 className="text-heading">{phase.name}</h2>
                    <span className="text-caption text-ink-muted tabular-nums">{weeksText(phase)}. {phase.goal}.</span>
                  </div>
                  {state && <Pill hue={state.hue} icon={state.icon}>{state.label}</Pill>}
                </header>
                <WeekStrip phase={phase} weeks={weeks} current={week} />
                <Rows>
                  {phase.epics.map((epic) => (
                    <Row
                      key={epic.key}
                      title={<span className="flex gap-2"><span className="shrink-0 text-key whitespace-nowrap text-ink-muted">{epic.key}</span>{epic.title}</span>}
                      detail={epic.description}
                      aside={
                        <span className="grid w-24 shrink-0 gap-1.5 text-right sm:w-40">
                          <span className="text-caption text-ink-muted tabular-nums">{epic.has_tasks ? progressText(epic.progress) : 'Sin tareas'}</span>
                          {epic.has_tasks && (
                            <ProgressTrack value={epic.progress.points_done} max={epic.progress.points} label={`${epic.key}: ${progressText(epic.progress)}`} inset className="w-full" />
                          )}
                        </span>
                      }
                    />
                  ))}
                </Rows>
                {phase.deliverables.length > 0 && (
                  <p className="text-caption text-ink-muted">Entregables: {phase.deliverables.join(', ')}.</p>
                )}
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
