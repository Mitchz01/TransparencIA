import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ReactNode } from 'react'
import type { Task, TaskStatus } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { cn, ColumnLabel, laneFill, StateLabel } from '@agile/ui'
import { Alert02Icon } from '@agile/ui/icons'
import { STATUS_HUE, STATUS_LABELS } from './boardLabels'
import { SortableTaskCard } from './TaskCard'

interface ColumnProps {
  status: TaskStatus
  tasks: Task[]
  members: Member[]
  wipLimit: number | null
  /** Shown while some cards are hidden by the filters, so the count doesn't lie. */
  total: number
  onOpen: (task: Task) => void
  /** After the cards, like "Agregar tarea". */
  children?: ReactNode
}

/** A column is a panel tinted with its hue: its label and count, the WIP warning in words, and its
 *  cards. While a card is dragged over it, the card's gap opens among them (spec 014). */
export function Column({ status, tasks, members, wipLimit, total, onOpen, children }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: `column:${status}`, data: { status } })
  const over = wipLimit !== null && total > wipLimit
  const count = wipLimit === null ? `${total}` : `${total} de ${wipLimit}`
  const hue = STATUS_HUE[status]

  return (
    <section
      aria-label={STATUS_LABELS[status]}
      className={cn('flex w-[min(300px,82vw)] shrink-0 snap-start flex-col gap-2 rounded-lg p-2 lg:w-auto lg:min-w-0 lg:shrink', laneFill(hue))}
    >
      <header className="flex min-h-control-sm flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="flex items-center gap-2">
          <ColumnLabel hue={hue}>{STATUS_LABELS[status]}</ColumnLabel>
          <span className="text-caption text-ink-muted tabular-nums" aria-label={wipLimit === null ? `${total} tareas` : `${total} de ${wipLimit} permitidas`}>
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
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} assignee={members.find((m) => m.id === task.assignee_id)} onOpen={() => onOpen(task)} />
          ))}
          {tasks.length === 0 && (
            <li className="rounded-md px-4 py-6 text-center text-caption text-ink-muted">Suelta una tarea aquí</li>
          )}
        </ul>
      </SortableContext>
      {children}
    </section>
  )
}
