import type { FieldError } from '../../application/errors'
import type { BoardGateway } from '../../application/ports'
import { PRIORITIES, TASK_LIMITS, TASK_STATUSES, type BoardView, type BoardWarning, type Task, type TaskPatch, type TaskResult } from '../../domain/board'
import { moveTask, nextTaskKey, sprintLoad, suggestsAdvance, teamCapacity, wipWarnings } from '../../domain/rules'
import { type FakeStore, fail, invalid, notFound, online, reply } from './store'

const STATUS_NAMES: Record<Task['status'], string> = {
  backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En curso', review: 'En revisión', done: 'Hecho',
}

const emptyBoard = (projectId: number): BoardView => ({
  project_id: projectId, continuous: false, wip_limits: [], capacity_override: null, sprints: [], objectives: [], tasks: [],
})

export function fakeBoardGateway(store: FakeStore, onSprintClosed: (projectId: number, sprintName: string, pendingKeys: string[]) => void): BoardGateway {
  const boardOfTask = (taskId: number) => {
    for (const board of store.boards.values()) {
      const task = board.tasks.find((t) => t.id === taskId)
      if (task) return { board, task }
    }
    return notFound('task', taskId)
  }

  function capacityOf(board: BoardView): number {
    const project = store.projects.get(board.project_id)
    const weeks = project?.plan?.methodology?.sprint_length_weeks ?? 2
    return board.capacity_override ?? teamCapacity(project?.members ?? [], weeks)
  }

  function refreshLoads(board: BoardView) {
    if (board.continuous) return
    const capacity = capacityOf(board)
    for (const sprint of board.sprints) sprint.load = sprintLoad(board.tasks, sprint.id, capacity)
  }

  /** The same rules as the service for a new task or an edit (spec 003, spec 014). */
  function fieldErrors(values: TaskPatch & { epic_key?: string }, board: BoardView): FieldError[] {
    const project = store.projects.get(board.project_id)
    const errors: FieldError[] = []
    if (values.status !== undefined && !TASK_STATUSES.includes(values.status)) errors.push({ field: 'status', message: 'Estado desconocido.' })
    if (values.priority !== undefined && !PRIORITIES.includes(values.priority)) errors.push({ field: 'priority', message: 'Prioridad desconocida.' })
    if (values.position !== undefined && (!Number.isInteger(values.position) || values.position < 0)) errors.push({ field: 'position', message: 'Debe ser 0 o más.' })
    if (values.title !== undefined && (!values.title.trim() || values.title.trim().length > TASK_LIMITS.title)) {
      errors.push({ field: 'title', message: `Entre 1 y ${TASK_LIMITS.title} caracteres.` })
    }
    if (values.points !== undefined && (!Number.isInteger(values.points) || values.points < 0 || values.points > 100)) {
      errors.push({ field: 'points', message: 'Debe estar entre 0 y 100.' })
    }
    if (values.sprint_id != null && !board.sprints.some((s) => s.id === values.sprint_id)) errors.push({ field: 'sprint_id', message: 'No es un sprint de este proyecto.' })
    if (values.assignee_id != null && !project?.members.some((m) => m.id === values.assignee_id)) {
      errors.push({ field: 'assignee_id', message: 'No es miembro de este proyecto.' })
    }
    if ((values.epic_key ?? '').length > TASK_LIMITS.epicKey) errors.push({ field: 'epic_key', message: `Máximo ${TASK_LIMITS.epicKey} caracteres.` })
    return errors
  }

  function result(board: BoardView, task: Task): TaskResult {
    const warnings: BoardWarning[] = wipWarnings(board.tasks, board.wip_limits, task.sprint_id).filter(
      (w) => w.code === 'wip_limit_exceeded' && w.column === task.status,
    )
    const sprint = board.sprints.find((s) => s.id === task.sprint_id)
    if (sprint?.load?.overloaded) {
      warnings.push({ code: 'sprint_overloaded', sprint_id: sprint.id, points: sprint.load.points, capacity: sprint.load.capacity })
    }
    return { task, warnings, suggest_advance: suggestsAdvance(task) }
  }

  return {
    async getBoard(projectId) {
      if (!store.projects.has(projectId)) notFound('project', projectId)
      return reply(store.boards.get(projectId) ?? emptyBoard(projectId))
    },

    async updateTask(taskId, patch) {
      await online()
      const { board, task } = boardOfTask(taskId)
      const errors = fieldErrors(patch, board)
      if (Object.keys(patch).length === 0) errors.unshift({ field: '', message: 'No hay cambios para guardar.' })
      if (errors.length) invalid(errors)

      const targetSprint = patch.sprint_id === undefined ? task.sprint_id : patch.sprint_id
      if (board.sprints.find((s) => s.id === targetSprint)?.closed) fail(409, { code: 'sprint_closed', detail: 'Ese sprint está cerrado.' })

      const moves = patch.status !== undefined || patch.position !== undefined || patch.sprint_id !== undefined
      if (moves) {
        const sprintChanged = patch.sprint_id !== undefined && patch.sprint_id !== task.sprint_id
        const status = patch.status ?? (sprintChanged ? (targetSprint === null ? 'backlog' : 'todo') : task.status)
        board.tasks = moveTask(board.tasks, taskId, { status, position: patch.position ?? Number.MAX_SAFE_INTEGER, sprint_id: targetSprint })
      }
      board.tasks = board.tasks.map((t) =>
        t.id !== taskId
          ? t
          : {
              ...t,
              ...(patch.title !== undefined && { title: patch.title.trim() }),
              ...(patch.description !== undefined && { description: patch.description }),
              ...(patch.points !== undefined && { points: patch.points }),
              ...(patch.priority !== undefined && { priority: patch.priority }),
              ...(patch.assignee_id !== undefined && { assignee_id: patch.assignee_id, missing_role: patch.assignee_id === null ? t.missing_role : null }),
            },
      )
      refreshLoads(board)
      const saved = board.tasks.find((t) => t.id === taskId)!
      if (saved.status !== task.status) {
        store.publish({
          type: 'task_status_changed', project_id: board.project_id, actor: 'person', ref: { kind: 'task', id: taskId },
          summary: `${saved.key} pasó a ${STATUS_NAMES[saved.status]}`, task_id: taskId, status: saved.status,
        })
      } else {
        store.publish({
          type: 'task_updated', project_id: board.project_id, actor: 'person', ref: { kind: 'task', id: taskId },
          summary: `${saved.key} se actualizó`, task_id: taskId,
        })
      }
      return reply(result(board, saved))
    },

    async createTask(projectId, values) {
      await online()
      if (!store.projects.has(projectId)) notFound('project', projectId)
      const board = store.boards.get(projectId) ?? notFound('project', projectId)
      const errors = fieldErrors(values, board)
      if (values.title === undefined) errors.unshift({ field: 'title', message: `Entre 1 y ${TASK_LIMITS.title} caracteres.` })
      if (errors.length) invalid(errors)
      const sprintId = values.sprint_id ?? null
      if (board.sprints.find((s) => s.id === sprintId)?.closed) fail(409, { code: 'sprint_closed', detail: 'Ese sprint está cerrado.' })

      const status = values.status ?? (sprintId !== null || board.continuous ? 'todo' : 'backlog')
      const column = board.tasks.filter((t) => t.status === status && (board.continuous || t.sprint_id === sprintId))
      const task: Task = {
        id: store.id(), project_id: projectId, sprint_id: sprintId, assignee_id: values.assignee_id ?? null, key: nextTaskKey(board.tasks),
        epic_key: values.epic_key ?? '', title: values.title.trim(), description: values.description ?? '', acceptance_criteria: [], checklist: [],
        type: 'feature', points: values.points ?? 1, priority: values.priority ?? 'medium', status, position: column.length, missing_role: null, issue: null,
      }
      board.tasks = [...board.tasks, task]
      refreshLoads(board)
      store.publish({
        type: 'task_created', project_id: projectId, actor: 'person', ref: { kind: 'task', id: task.id },
        summary: `Se creó ${task.key}`, task_id: task.id, key: task.key, status, sprint_id: sprintId,
      })
      return reply(result(board, task))
    },

    async setChecklist(taskId, items) {
      await online()
      const { board } = boardOfTask(taskId)
      const errors: FieldError[] = []
      if (items.length > TASK_LIMITS.checklistItems) errors.push({ field: 'items', message: `Máximo ${TASK_LIMITS.checklistItems} ítems.` })
      items.forEach((item, i) => {
        const text = item.text.trim()
        if (!text || text.length > TASK_LIMITS.checklistText) errors.push({ field: `items[${i}].text`, message: `Entre 1 y ${TASK_LIMITS.checklistText} caracteres.` })
      })
      if (errors.length) invalid(errors)
      board.tasks = board.tasks.map((t) => (t.id === taskId ? { ...t, checklist: items.map((i) => ({ text: i.text.trim(), done: i.done })) } : t))
      const saved = board.tasks.find((t) => t.id === taskId)!
      store.publish({
        type: 'task_updated', project_id: board.project_id, actor: 'person', ref: { kind: 'task', id: taskId },
        summary: `Se actualizó el checklist de ${saved.key}`, task_id: taskId,
      })
      return reply(result(board, saved))
    },

    async setCapacity(projectId, points) {
      await online()
      if (!store.projects.has(projectId)) notFound('project', projectId)
      const board = store.boards.get(projectId)
      if (!board || board.continuous) fail(409, { code: 'capacity_not_applicable', detail: 'Este tablero no tiene sprints.' })
      if (points !== null && (!Number.isInteger(points) || points < 1 || points > 500)) {
        invalid([{ field: 'points_per_sprint', message: 'Debe estar entre 1 y 500.' }])
      }
      board!.capacity_override = points
      refreshLoads(board!)
      return reply({ capacity_override: points, sprints: board!.sprints.map((s) => ({ id: s.id, load: s.load })) })
    },

    async closeSprint(sprintId) {
      await online()
      const board = [...store.boards.values()].find((b) => b.sprints.some((s) => s.id === sprintId))
      const sprint = board?.sprints.find((s) => s.id === sprintId) ?? notFound('sprint', sprintId)
      if (sprint.closed) fail(409, { code: 'sprint_already_closed', detail: `${sprint.name} ya está cerrado.` })
      sprint.closed = true
      const pending = board!.tasks.filter((t) => t.sprint_id === sprintId && t.status !== 'done').map((t) => t.key)
      store.publish({
        type: 'sprint_closed', project_id: board!.project_id, actor: 'person', ref: { kind: 'sprint', id: sprintId },
        summary: `Se cerró ${sprint.name}`, sprint_id: sprintId, pending_task_keys: pending,
      })
      if (pending.length) onSprintClosed(board!.project_id, sprint.name, pending)
      return reply({ sprint, pending_task_keys: pending, replan_proposed: pending.length > 0 })
    },
  }
}
