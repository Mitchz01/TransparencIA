import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStatus, WipLimit } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { columnTasks, wipLimitOf } from '../../../domain/rules'
import { STATUS_LABELS } from './boardLabels'
import { Column } from './Column'
import { TaskCard } from './TaskCard'

interface KanbanBoardProps {
  columns: readonly TaskStatus[]
  /** All tasks of the sprint (or the whole board when continuous). */
  tasks: Task[]
  /** The ones that pass the filters. */
  visible: Task[]
  sprintId: number | null
  members: Member[]
  wipLimits: WipLimit[]
  onMove: (taskId: number, status: TaskStatus, position: number) => void
  onOpen: (task: Task) => void
}

/** Where a drop lands: over a card, at that card's place; over a column, at its end. */
function target(event: DragEndEvent, tasks: Task[], sprintId: number | null): { status: TaskStatus; position: number } | null {
  const { over } = event
  if (!over) return null
  const overTask = tasks.find((t) => t.id === over.id)
  if (overTask) {
    const column = columnTasks(tasks, overTask.status, sprintId)
    return { status: overTask.status, position: column.findIndex((t) => t.id === overTask.id) }
  }
  const status = (over.data.current as { status?: TaskStatus } | undefined)?.status
  return status ? { status, position: columnTasks(tasks, status, sprintId).length } : null
}

export function KanbanBoard({ columns, tasks, visible, sprintId, members, wipLimits, onMove, onOpen }: KanbanBoardProps) {
  const [dragging, setDragging] = useState<Task | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const firstWithCards = columns.findIndex((status) => columnTasks(visible, status, sprintId).length > 0)

  // On narrow screens the columns scroll sideways: open on the first one with cards, not on an empty one.
  useEffect(() => {
    const node = scroller.current
    if (!node || node.scrollWidth <= node.clientWidth || firstWithCards <= 0) return
    const column = node.children[firstWithCards] as HTMLElement | undefined
    if (column) node.scrollLeft = column.offsetLeft - node.offsetLeft - 16
  }, [sprintId, firstWithCards])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  const name = (id: string | number) => tasks.find((t) => t.id === id)?.key ?? 'La tarea'
  const place = (overId: string | number | undefined, data?: { status?: TaskStatus }) => {
    const status = tasks.find((t) => t.id === overId)?.status ?? data?.status
    return status ? STATUS_LABELS[status] : 'fuera del tablero'
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${name(active.id)}.`,
    onDragOver: ({ active, over }) => `${name(active.id)} está sobre ${place(over?.id, over?.data.current)}.`,
    onDragEnd: ({ active, over }) => `Soltaste ${name(active.id)} en ${place(over?.id, over?.data.current)}.`,
    onDragCancel: ({ active }) => `Cancelaste el movimiento de ${name(active.id)}.`,
  }

  const onDragStart = ({ active }: DragStartEvent) => setDragging(tasks.find((t) => t.id === active.id) ?? null)

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const task = tasks.find((t) => t.id === event.active.id)
    const to = target(event, tasks, sprintId)
    if (!task || !to) return
    if (to.status === task.status && to.position === task.position) return
    onMove(task.id, to.status, to.position)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Para mover una tarea, presiona espacio. Muévela con las flechas y suéltala con espacio o enter. Escape cancela. Enter abre la tarea.',
        },
      }}
    >
      <div
        ref={scroller}
        className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:scroll-px-0 md:px-0 lg:grid lg:overflow-visible"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columnTasks(visible, status, sprintId)}
            total={columnTasks(tasks, status, sprintId).length}
            members={members}
            wipLimit={wipLimitOf(wipLimits, status)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <TaskCard task={dragging} assignee={members.find((m) => m.id === dragging.assignee_id)} overlay />}
      </DragOverlay>
    </DndContext>
  )
}
