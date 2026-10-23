// Spec 017. Owner: P5. The plan's phases (the board's sprints) in order: finished, under way or next, with a bar
// for the share of their work done (points from the backend's SprintProgress) and their dates.
import type { SprintProgress } from '@agile/domain'
import { cn } from '../cn'
import { StateLabel, type Hue } from '../Pill'
import { ProgressTrack } from '../ProgressTrack'
import { Clock01Icon, Loading03Icon, Tick02Icon } from '../icons'
import { addDays, shortDay } from './format'

type Status = 'done' | 'current' | 'next'

const STATUS: Record<Status, { word: string; hue: Hue; icon: typeof Tick02Icon }> = {
  done: { word: 'Terminada', hue: 'teal', icon: Tick02Icon },
  current: { word: 'En curso', hue: 'blue', icon: Loading03Icon },
  next: { word: 'Por venir', hue: 'neutral', icon: Clock01Icon },
}

/** `start` is the contract's first day: the first phase starts there, each next one the day after the last ends. */
export function PhaseStrip({ sprints, start }: { sprints: SprintProgress[]; start: string }) {
  if (sprints.length === 0) return null
  const firstOpen = sprints.findIndex((sprint) => sprint.total_points === 0 || sprint.done_points < sprint.total_points)
  return (
    // Phone: one row that scrolls sideways. Wide screens: every phase in view.
    <ol
      className="grid auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] lg:grid-flow-row lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] lg:overflow-visible lg:pb-0"
      aria-label="Fases del plan"
    >
      {sprints.map((sprint, i) => {
        const status: Status = firstOpen === -1 || i < firstOpen ? 'done' : i === firstOpen ? 'current' : 'next'
        const { word, hue, icon } = STATUS[status]
        const from = i === 0 ? start : sprints[i - 1].end_date ? addDays(sprints[i - 1].end_date as string, 1) : null
        return (
          <li key={sprint.name} className={cn('grid content-start gap-2.5 rounded-lg p-4', status === 'current' ? 'bg-primary-soft' : 'bg-surface')}>
            <StateLabel hue={hue} icon={icon}>{word}</StateLabel>
            <h3 className="text-label">{sprint.name}</h3>
            <ProgressTrack
              value={sprint.done_points}
              max={sprint.total_points}
              inset={status === 'current'}
              label={`${sprint.name}: ${sprint.done_points} de ${sprint.total_points} puntos de trabajo`}
            />
            {sprint.end_date && (
              <span className="text-caption text-ink-muted">{from ? `${shortDay(from)} al ${shortDay(sprint.end_date)}` : `Hasta ${shortDay(sprint.end_date)}`}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
