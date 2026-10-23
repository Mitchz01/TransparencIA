import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBoard, useMoveTask } from '../../application/use-cases/useBoard'
import type { Priority } from '../../domain/board'
import { BOARD_COLUMNS, CONTINUOUS_COLUMNS, defaultSprint, filterTasks, sprintLoad, type TaskFilters } from '../../domain/rules'
import { BoardFilters } from '../components/board/BoardFilters'
import { CapacityBar } from '../components/board/CapacityBar'
import { KanbanBoard } from '../components/board/KanbanBoard'
import { TaskDrawer } from '../components/board/TaskDrawer'
import { ButtonLink, EmptyState, Segmented, Skeleton, SkeletonCard } from '../components/ds'
import { AiMagicIcon, DashboardSquare01Icon } from '../components/ds/icons'
import { PageHeader } from '../components/shell/PageHeader'
import { TopBarViews } from '../components/shell/TopBarViews'
import { formatDate } from '../format'
import { useCurrentProject } from './ProjectLayout'

const PRIORITY_VALUES = new Set<string>(['high', 'medium', 'low'])

/** Filters and the chosen sprint live in the address (?sprint=&assignee=&priority=&epic=). */
function useBoardParams() {
  const [params, setParams] = useSearchParams()
  const assignee = params.get('assignee')
  const priority = params.get('priority')
  const filters: TaskFilters = {
    assignee: assignee === null ? undefined : assignee === 'none' ? 'none' : Number(assignee),
    priority: priority && PRIORITY_VALUES.has(priority) ? (priority as Priority) : undefined,
    epic: params.get('epic') ?? undefined,
  }
  const update = (change: Record<string, string | undefined>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(change)) {
        if (value === undefined) next.delete(key)
        else next.set(key, value)
      }
      return next
    }, { replace: true })
  return {
    sprintParam: Number(params.get('sprint')),
    filters,
    setSprint: (id: number) => update({ sprint: String(id) }),
    setFilters: (f: TaskFilters) => update({ assignee: f.assignee === undefined ? undefined : String(f.assignee), priority: f.priority, epic: f.epic }),
  }
}

export function BoardPage() {
  const project = useCurrentProject()
  const { data: board, isPending } = useBoard(project.id)
  const move = useMoveTask(project.id)
  const { sprintParam, filters, setSprint, setFilters } = useBoardParams()
  const [openId, setOpenId] = useState<number | null>(null)

  if (isPending) {
    return (
      <div className="grid gap-4 pt-10">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 lg:grid-cols-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    )
  }

  if (!board || board.tasks.length === 0) {
    return (
      <>
        <PageHeader title="Tablero" />
        <EmptyState
          icon={DashboardSquare01Icon}
          title="Todavía no hay tablero"
          action={<ButtonLink to={`/projects/${project.id}/planning`} variant="primary" icon={AiMagicIcon}>Ir a la planificación</ButtonLink>}
        >
          Aparece cuando apruebes los sprints. Las tareas salen del backlog que propone el agente.
        </EmptyState>
      </>
    )
  }

  const continuous = board.continuous
  const sprint = continuous ? null : board.sprints.find((s) => s.id === sprintParam) ?? defaultSprint(board.sprints, board.tasks)
  const sprintId = sprint?.id ?? null
  const scope = board.tasks.filter((t) => t.sprint_id === sprintId)
  const visible = filterTasks(scope, filters)
  const epics = [...new Set(scope.map((t) => t.epic_key))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const load = sprint?.load ? sprintLoad(board.tasks, sprint.id, sprint.load.capacity) : null
  const open = board.tasks.find((t) => t.id === openId)
  const columns = continuous ? CONTINUOUS_COLUMNS : BOARD_COLUMNS

  return (
    <>
      {!continuous && board.sprints.length > 0 && (
        <TopBarViews>
          <Segmented
            label="Sprint"
            value={String(sprintId)}
            options={[...board.sprints].sort((a, b) => a.number - b.number).map((s) => ({ value: String(s.id), label: s.name }))}
            onChange={(id) => setSprint(Number(id))}
          />
        </TopBarViews>
      )}
      <PageHeader
        title={sprint?.name ?? 'Tablero'}
        description={sprint ? `${sprint.goal}. Fase ${sprint.phase}${sprint.end_date ? `, termina el ${formatDate(sprint.end_date)}` : ''}.` : 'Kanban: todas las tareas en un flujo continuo.'}
        actions={load && sprint ? <CapacityBar projectId={project.id} load={load} override={board.capacity_override} /> : undefined}
      />
      <div className="mb-5">
        <BoardFilters filters={filters} members={project.members} epics={epics} onChange={setFilters} />
      </div>
      <KanbanBoard
        columns={columns}
        tasks={scope}
        visible={visible}
        sprintId={sprintId}
        members={project.members}
        wipLimits={board.wip_limits}
        onMove={(taskId, status, position) => move.mutate({ taskId, status, position })}
        onOpen={(task) => setOpenId(task.id)}
      />
      {open && <TaskDrawer key={open.id} projectId={project.id} task={open} members={project.members} columns={columns} onClose={() => setOpenId(null)} />}
    </>
  )
}
