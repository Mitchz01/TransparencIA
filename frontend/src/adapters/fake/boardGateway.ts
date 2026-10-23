import type { FieldError } from '../../application/errors'
import type { BoardGateway } from '../../application/ports'
import { PRIORITIES, TASK_LIMITS, TASK_STATUSES, type BoardView, type BoardWarning, type Task, type TaskResult } from '../../domain/board'
import { moveTask, sprintLoad, suggestsAdvance, teamCapacity, wipWarnings } from '../../domain/rules'
import { type FakeStore, fail, invalid, notFound, online, reply } from './store'

const STATUS_NAMES: Record<Task['status'], string> = {
  backlog: 'Backlog', todo: 'To do', in_progress: 'In progress', review: 'Review', done: 'Done',
}

const emptyBoard = (projectId: number): BoardView => ({
  project_id: projectId, continuous: false, wip_limits: [], capacity_override: null, sprints: [], objectives: [], tasks: [],
})

export function fakeBoardGateway(store: FakeStore): BoardGateway {
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
      const project = store.projects.get(board.project_id)
      const errors: FieldError[] = []
      if (Object.keys(patch).length === 0) errors.push({ field: '', message: 'No fields to update.' })
      if (patch.status !== undefined && !TASK_STATUSES.includes(patch.status)) errors.push({ field: 'status', message: 'Unknown status.' })
      if (patch.priority !== undefined && !PRIORITIES.includes(patch.priority)) errors.push({ field: 'priority', message: 'Unknown priority.' })
      if (patch.position !== undefined && (!Number.isInteger(patch.position) || patch.position < 0)) errors.push({ field: 'position', message: 'Must be 0 or more.' })
      if (patch.title !== undefined && (!patch.title.trim() || patch.title.trim().length > TASK_LIMITS.title)) {
        errors.push({ field: 'title', message: `Between 1 and ${TASK_LIMITS.title} characters.` })
      }
      if (patch.points !== undefined && (!Number.isInteger(patch.points) || patch.points < 0 || patch.points > 100)) {
        errors.push({ field: 'points', message: 'Must be between 0 and 100.' })
      }
      if (patch.sprint_id != null && !board.sprints.some((s) => s.id === patch.sprint_id)) errors.push({ field: 'sprint_id', message: 'Not a sprint of this project.' })
      if (patch.assignee_id != null && !project?.members.some((m) => m.id === patch.assignee_id)) {
        errors.push({ field: 'assignee_id', message: 'Not a member of this project.' })
      }
      if (errors.length) invalid(errors)

      const targetSprint = patch.sprint_id === undefined ? task.sprint_id : patch.sprint_id
      if (board.sprints.find((s) => s.id === targetSprint)?.closed) fail(409, { code: 'sprint_closed', detail: 'That sprint is closed.' })

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
          summary: `${saved.key} moved to ${STATUS_NAMES[saved.status]}`, task_id: taskId, status: saved.status,
        })
      } else {
        store.publish({
          type: 'task_updated', project_id: board.project_id, actor: 'person', ref: { kind: 'task', id: taskId },
          summary: `${saved.key} was updated`, task_id: taskId,
        })
      }
      return reply(result(board, saved))
    },

    async setChecklist(taskId, items) {
      await online()
      const { board } = boardOfTask(taskId)
      const errors: FieldError[] = []
      if (items.length > TASK_LIMITS.checklistItems) errors.push({ field: 'items', message: `Max ${TASK_LIMITS.checklistItems} items.` })
      items.forEach((item, i) => {
        const text = item.text.trim()
        if (!text || text.length > TASK_LIMITS.checklistText) errors.push({ field: `items[${i}].text`, message: `Between 1 and ${TASK_LIMITS.checklistText} characters.` })
      })
      if (errors.length) invalid(errors)
      board.tasks = board.tasks.map((t) => (t.id === taskId ? { ...t, checklist: items.map((i) => ({ text: i.text.trim(), done: i.done })) } : t))
      const saved = board.tasks.find((t) => t.id === taskId)!
      store.publish({
        type: 'task_updated', project_id: board.project_id, actor: 'person', ref: { kind: 'task', id: taskId },
        summary: `${saved.key} checklist updated`, task_id: taskId,
      })
      return reply(result(board, saved))
    },

    async setCapacity(projectId, points) {
      await online()
      if (!store.projects.has(projectId)) notFound('project', projectId)
      const board = store.boards.get(projectId)
      if (!board || board.continuous) fail(409, { code: 'capacity_not_applicable', detail: 'This board has no sprints.' })
      if (points !== null && (!Number.isInteger(points) || points < 1 || points > 500)) {
        invalid([{ field: 'points_per_sprint', message: 'Must be between 1 and 500.' }])
      }
      board!.capacity_override = points
      refreshLoads(board!)
      return reply({ capacity_override: points, sprints: board!.sprints.map((s) => ({ id: s.id, load: s.load })) })
    },

    async closeSprint(sprintId) {
      await online()
      const board = [...store.boards.values()].find((b) => b.sprints.some((s) => s.id === sprintId))
      const sprint = board?.sprints.find((s) => s.id === sprintId) ?? notFound('sprint', sprintId)
      if (sprint.closed) fail(409, { code: 'sprint_already_closed', detail: `${sprint.name} is already closed.` })
      sprint.closed = true
      const pending = board!.tasks.filter((t) => t.sprint_id === sprintId && t.status !== 'done').map((t) => t.key)
      store.publish({
        type: 'sprint_closed', project_id: board!.project_id, actor: 'person', ref: { kind: 'sprint', id: sprintId },
        summary: `${sprint.name} was closed`, sprint_id: sprintId, pending_task_keys: pending,
      })
      return reply({ sprint, pending_task_keys: pending, replan_proposed: false })
    },
  }
}
