// Spec 017 (FR-024). Owner: P5. What's still missing in the plan: what's under way first, then what's pending,
// phase by phase with each phase's deadline. What's done lives in the weekly timeline, next to its evidence.
import type { PhaseTask, SprintProgress } from '@agile/domain'
import { useState } from 'react'
import { Button } from '../Button'
import { StateLabel } from '../Pill'
import { Clock01Icon, Loading03Icon } from '../icons'
import { shortDay } from './format'

const PHASES_SHOWN = 2

interface Group {
  phase: string
  deadline: string | null
  tasks: PhaseTask[]
}

export function WorkStatus({ sprints }: { sprints: SprintProgress[] }) {
  const [all, setAll] = useState(false)
  const missing: Group[] = sprints
    .map((sprint) => ({ phase: sprint.name, deadline: sprint.end_date, tasks: sprint.tasks.filter((t) => t.status !== 'done') }))
    .filter((group) => group.tasks.length > 0)
  const shown = all ? missing : missing.slice(0, PHASES_SHOWN)

  if (missing.length === 0) {
    return <p className="rounded-lg bg-surface p-5 text-body text-ink-muted">No queda ninguna actividad por hacer.</p>
  }
  return (
    <div className="grid gap-4 rounded-lg bg-surface p-5">
      {shown.map((group) => (
        <div key={group.phase} className="grid gap-2">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-label">
            {group.phase}
            {group.deadline && <span className="text-caption text-ink-muted">Hasta el {shortDay(group.deadline)}</span>}
          </p>
          <ul className="grid gap-1.5">
            {group.tasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 rounded-md bg-inset px-3 py-2.5">
                <span className="text-body">{task.title}</span>
                {task.status === 'in_progress' ? (
                  <StateLabel hue="blue" icon={Loading03Icon}>En curso</StateLabel>
                ) : (
                  <StateLabel hue="neutral" icon={Clock01Icon}>Pendiente</StateLabel>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {missing.length > PHASES_SHOWN && (
        <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setAll(!all)}>
          {all ? 'Ver solo lo próximo' : `Ver las ${missing.length} fases que faltan`}
        </Button>
      )}
    </div>
  )
}
