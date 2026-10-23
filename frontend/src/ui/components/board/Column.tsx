import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { cn, StateLabel } from '../ds'
import { Alert02Icon } from '../ds/icons'
import { STATUS_LABELS } from './boardLabels'
import { SortableTaskCard } from './TaskCard'

interface ColumnProps {
  status: TaskStatus
  tasks: Task[]
  members: Member[]
  wipLimit: number | null
  /** Shown while some cards are hidden by the filters, so the count doesn't lie. */
  total: number
  onOpen: (task: Task) => void
}

/** A column: its name and count, the WIP warning in words, and its cards. No colored dots. */
export function Column({ status, tasks, members, wipLimit, total, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, data: { status } })
  const over = wipLimit !== null && total > wipLimit
  const count = wipLimit === null ? `${total}` : `${total} de ${wipLimit}`

  return (
    <section aria-label={STATUS_LABELS[status]} className="flex w-[min(300px,82vw)] shrink-0 snap-start flex-col gap-3 lg:w-auto lg:min-w-0 lg:shrink">
      <header className="flex min-h-control-sm items-center justify-between gap-2 px-1">
        <h2 className="flex items-baseline gap-2 text-label">
          {STATUS_LABELS[status]}
          <span className="text-caption text-ink-subtle tabular-nums" aria-label={wipLimit === null ? `${total} tareas` : `${total} de ${wipLimit} permitidas`}>
            {count}
          </span>
        </h2>
        {over && (
          <StateLabel hue="amber" icon={Alert02Icon} className="text-caption">
            Límite WIP superado
          </StateLabel>
        )}
      </header>
      <SortableContext id={status} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn('flex min-h-40 flex-1 flex-col gap-3 rounded-lg p-1 transition-[background-color] duration-150', isOver && 'bg-surface-strong')}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} assignee={members.find((m) => m.id === task.assignee_id)} onOpen={() => onOpen(task)} />
          ))}
          {tasks.length === 0 && (
            <li className="rounded-lg px-4 py-10 text-center text-caption text-ink-subtle">Suelta una tarea aquí</li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}
