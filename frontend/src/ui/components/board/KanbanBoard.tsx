import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Task, TaskStatus, WipLimit } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { columnTasks, moveTask, wipLimitOf } from '../../../domain/rules'
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
  /** Rendered at the end of each column, like "Agregar tarea" (spec 014). */
  columnFooter?: (status: TaskStatus) => ReactNode
}

type Over = NonNullable<DragOverEvent['over']>

/** The column and index a card would take: over a card, at that card's place (after it when the
 *  dragged card is below its middle); over a column, at its end. */
function landing(over: Over, activeTop: number | undefined, tasks: Task[], sprintId: number | null): { status: TaskStatus; position: number } | null {
  const overTask = tasks.find((t) => t.id === over.id)
  if (overTask) {
    const index = columnTasks(tasks, overTask.status, sprintId).findIndex((t) => t.id === overTask.id)
    const below = activeTop !== undefined && activeTop > over.rect.top + over.rect.height / 2
    return { status: overTask.status, position: index + (below ? 1 : 0) }
  }
  const status = (over.data.current as { status?: TaskStatus } | undefined)?.status
  return status ? { status, position: columnTasks(tasks, status, sprintId).length } : null
}

export function KanbanBoard({ columns, tasks, visible, sprintId, members, wipLimits, onMove, onOpen, columnFooter }: KanbanBoardProps) {
  const [dragging, setDragging] = useState<Task | null>(null)
  // While dragging (and until the saved move comes back), the board shows this order: the card
  // already sits in the column under the pointer, so that column opens a gap for it (spec 014, US6).
  // It only applies to the board it was made from: the saved move, a failed one put back or a live
  // update replace it.
  const signature = tasks.map((t) => `${t.id}:${t.sprint_id}:${t.status}:${t.position}`).join()
  const [drafted, setDrafted] = useState<{ base: string; tasks: Task[] } | null>(null)
  const draft = drafted?.base === signature ? drafted.tasks : null
  const setDraft = (next: Task[] | null) => setDrafted(next && { base: signature, tasks: next })
  const scroller = useRef<HTMLDivElement>(null)
  const firstWithCards = columns.findIndex((status) => columnTasks(visible, status, sprintId).length > 0)

  const shown = draft ?? tasks
  const visibleIds = new Set(visible.map((t) => t.id))
  const shownVisible = draft ? draft.filter((t) => visibleIds.has(t.id)) : visible

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
    const status = shown.find((t) => t.id === overId)?.status ?? data?.status
    return status ? STATUS_LABELS[status] : 'fuera del tablero'
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${name(active.id)}.`,
    onDragOver: ({ active, over }) => `${name(active.id)} está sobre ${place(over?.id, over?.data.current)}.`,
    onDragEnd: ({ active, over }) => `Soltaste ${name(active.id)} en ${place(over?.id, over?.data.current)}.`,
    onDragCancel: ({ active }) => `Cancelaste el movimiento de ${name(active.id)}.`,
  }

  const onDragStart = ({ active }: DragStartEvent) => setDragging(tasks.find((t) => t.id === active.id) ?? null)

  // Only a change of column touches the draft; inside a column the sortable list makes the gap itself.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || over.id === active.id) return
    const current = draft ?? tasks
    const task = current.find((t) => t.id === active.id)
    const to = landing(over, active.rect.current.translated?.top, current, sprintId)
    if (!task || !to || to.status === task.status) return
    setDraft(moveTask(current, task.id, to))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const current = draft ?? tasks
    const original = tasks.find((t) => t.id === active.id)
    const task = current.find((t) => t.id === active.id)
    if (!original || !task || !over) return setDraft(null)
    const overTask = current.find((t) => t.id === over.id)
    // Dropped on its own gap, or on its column: it stays where the draft put it.
    const position =
      overTask && overTask.id !== task.id && overTask.status === task.status
        ? columnTasks(current, task.status, sprintId).findIndex((t) => t.id === overTask.id)
        : task.position
    if (task.status === original.status && position === original.position) return setDraft(null)
    setDraft(moveTask(current, task.id, { status: task.status, position }))
    onMove(task.id, task.status, position)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null)
        setDraft(null)
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Para mover una tarea, presiona espacio. Muévela con las flechas y suéltala con espacio o enter. Escape cancela. Enter abre la tarea.',
        },
      }}
    >
      <div
        ref={scroller}
        className="relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:scroll-px-0 md:px-0 lg:grid lg:overflow-visible"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columnTasks(shownVisible, status, sprintId)}
            total={columnTasks(shown, status, sprintId).length}
            members={members}
            wipLimit={wipLimitOf(wipLimits, status)}
            onOpen={onOpen}
          >
            {columnFooter?.(status)}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <TaskCard task={dragging} assignee={members.find((m) => m.id === dragging.assignee_id)} overlay />}
      </DragOverlay>
    </DndContext>
  )
}
