import { useSortable } from '@dnd-kit/sortable'
import type { Task } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { checklistProgress } from '../../../domain/rules'
import { points } from '../../format'
import { Avatar, cn, Icon, ProgressTrack, StateLabel } from '../ds'
import { CheckListIcon, Flag02Icon, UserWarning01Icon } from '../ds/icons'
import { IssueBadge } from '../integrations/IssueBadge'
import { PRIORITY_LOOK } from './boardLabels'

interface TaskCardProps {
  task: Task
  assignee?: Member
  /** The copy that follows the pointer while dragging: lifted with a shadow and a 1 degree tilt. */
  overlay?: boolean
  onOpen?: () => void
}

/** Title, checklist progress and one data row: key, checklist, points, issue, priority, who has it.
 *  The description stays in the task panel. */
export function TaskCard({ task, assignee, overlay = false, onOpen }: TaskCardProps) {
  const progress = checklistProgress(task.checklist)
  const priority = PRIORITY_LOOK[task.priority]
  return (
    <article
      className={cn(
        'grid gap-3 rounded-md bg-card p-4 text-left',
        overlay && 'rotate-1 cursor-grabbing shadow-float',
        onOpen && 'cursor-pointer transition-[background-color] duration-150 hover:bg-card-hover',
      )}
      onClick={onOpen}
    >
      <h3 className="line-clamp-2 text-label font-semibold break-words" title={task.title}>{task.title}</h3>
      {progress.total > 0 && progress.done > 0 && !progress.complete && (
        <ProgressTrack value={progress.done} max={progress.total} label={`Checklist ${progress.done} de ${progress.total}`} className="bg-card-inset!" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted tabular-nums">
          <span className="text-key">{task.key}</span>
          {progress.total > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={`Checklist ${progress.done} de ${progress.total}`}>
              <Icon icon={CheckListIcon} size={16} />
              {progress.done}/{progress.total}
            </span>
          )}
          <span>{points(task.points)}</span>
          {task.issue && <IssueBadge issue={task.issue} />}
          <StateLabel hue={priority.hue} icon={Flag02Icon} className="text-caption">
            <span className="sr-only">Prioridad </span>
            {priority.label}
          </StateLabel>
        </div>
        {assignee ? (
          <span className="ml-auto inline-flex" title={assignee.name}>
            <Avatar name={assignee.name} className="bg-card-inset!" />
            <span className="sr-only">{assignee.name}</span>
          </span>
        ) : task.missing_role ? (
          <StateLabel hue="amber" icon={UserWarning01Icon} className="ml-auto min-w-0 text-caption">
            <span className="truncate">Falta {task.missing_role}</span>
          </StateLabel>
        ) : (
          <span className="ml-auto text-caption text-ink-muted">Sin asignar</span>
        )}
      </div>
    </article>
  )
}

/** A card that can be dragged with the pointer or the keyboard (space to pick up, arrows to move). */
export function SortableTaskCard({ task, assignee, onOpen }: Omit<TaskCardProps, 'overlay'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { status: task.status } })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={cn('touch-none rounded-md', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
      aria-roledescription="tarea arrastrable"
      aria-label={`${task.key} ${task.title}`}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event)
        if (event.key === 'Enter' && !isDragging && onOpen) {
          // Keep the same key press from reaching the drawer's first button once it opens.
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <TaskCard task={task} assignee={assignee} onOpen={onOpen} />
    </li>
  )
}
