import type { Task, TaskStatus } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { checklistProgress, columnTasks } from '../../../domain/rules'
import { points } from '../../format'
import { Avatar, cn, ColumnLabel, Icon, laneFill, StateLabel } from '../ds'
import { CheckListIcon, Flag02Icon, UserWarning01Icon } from '../ds/icons'
import { PRIORITY_LOOK, STATUS_HUE, STATUS_LABELS } from './boardLabels'

interface TaskListProps {
  columns: readonly TaskStatus[]
  /** The tasks that pass the filters. */
  tasks: Task[]
  sprintId: number | null
  members: Member[]
  onOpen: (task: Task) => void
}

function TaskRow({ task, assignee, onOpen }: { task: Task; assignee?: Member; onOpen: () => void }) {
  const progress = checklistProgress(task.checklist)
  const priority = PRIORITY_LOOK[task.priority]
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 rounded-md bg-card px-4 py-3 text-left transition-[background-color] duration-150 hover:bg-card-hover sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem_5.5rem_3.5rem_3.5rem]"
      >
        <span className="text-key text-ink-muted tabular-nums">{task.key}</span>
        <span className="truncate text-label" title={task.title}>{task.title}</span>
        <span className="hidden min-w-0 items-center gap-2 text-caption text-ink-muted sm:flex">
          {assignee ? (
            <>
              <Avatar name={assignee.name} src={assignee.avatar_url} className="bg-card-inset!" />
              <span className="truncate">{assignee.name}</span>
            </>
          ) : task.missing_role ? (
            <StateLabel hue="amber" icon={UserWarning01Icon} className="min-w-0 text-caption">
              <span className="truncate">Falta {task.missing_role}</span>
            </StateLabel>
          ) : (
            'Sin asignar'
          )}
        </span>
        <StateLabel hue={priority.hue} icon={Flag02Icon} className="text-caption">
          <span className="sr-only">Prioridad </span>
          {priority.label}
        </StateLabel>
        <span className="hidden text-caption text-ink-muted tabular-nums sm:block">{points(task.points)}</span>
        <span className={cn('hidden items-center gap-1 text-caption text-ink-muted tabular-nums sm:inline-flex', progress.total === 0 && 'invisible')} aria-label={`Checklist ${progress.done} de ${progress.total}`}>
          <Icon icon={CheckListIcon} size={16} />
          {progress.done}/{progress.total}
        </span>
      </button>
    </li>
  )
}

/** The same tasks as the board, one row each, grouped by column under the column's label (spec 014). */
export function TaskList({ columns, tasks, sprintId, members, onOpen }: TaskListProps) {
  const groups = columns.map((status) => ({ status, tasks: columnTasks(tasks, status, sprintId) })).filter((g) => g.tasks.length > 0)
  if (groups.length === 0) {
    return <p className="rounded-lg bg-lane px-4 py-10 text-center text-caption text-ink-muted">Ninguna tarea con estos filtros.</p>
  }
  return (
    <div className="grid gap-3 pb-4">
      {groups.map(({ status, tasks: rows }) => (
        <section key={status} aria-label={STATUS_LABELS[status]} className={cn('grid gap-2 rounded-lg p-2', laneFill(STATUS_HUE[status]))}>
          <h2 className="flex items-center gap-2 px-1">
            <ColumnLabel hue={STATUS_HUE[status]}>{STATUS_LABELS[status]}</ColumnLabel>
            <span className="text-caption text-ink-muted tabular-nums" aria-label={`${rows.length} tareas`}>{rows.length}</span>
          </h2>
          <ul className="grid gap-1.5">
            {rows.map((task) => (
              <TaskRow key={task.id} task={task} assignee={members.find((m) => m.id === task.assignee_id)} onOpen={() => onOpen(task)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
