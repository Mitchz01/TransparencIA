// Pure rules the screens share with the service, mirrored so the UI reacts before the server answers.

import type { BoardWarning, ChecklistItem, NewTask, Priority, Sprint, SprintLoad, Task, TaskStatus, WipLimit } from './board'
import {
  LIMITS, REQUESTED_METHODOLOGIES, validateProjectCreate,
  type FieldIssue, type Member, type ProjectCreate, type ProjectUpdate, type Seniority,
} from './project'

// ---------- Forms (contract section 4, the validation tables of each gateway) ----------

/** Field path → first message, the same paths as the API's 422 `errors[].field` ("skills[1]"). */
export type FieldErrors = Record<string, string>

export const toFieldErrors = (issues: FieldIssue[]): FieldErrors =>
  issues.reduce<FieldErrors>((errors, { field, message }) => (field in errors ? errors : { ...errors, [field]: message }), {})

export function validateProject(body: ProjectCreate | ProjectUpdate): FieldErrors {
  const issues = 'name' in body && 'description' in body
    ? validateProjectCreate(body as ProjectCreate)
    : [
        ...(body.name !== undefined && !body.name.trim() ? [{ field: 'name', message: 'Obligatorio.' }] : []),
        ...(body.name && body.name.trim().length > LIMITS.name ? [{ field: 'name', message: `Máximo ${LIMITS.name} caracteres.` }] : []),
      ]
  if (body.requested_methodology !== undefined && !REQUESTED_METHODOLOGIES.includes(body.requested_methodology)) {
    issues.push({ field: 'requested_methodology', message: 'Elige una opción de la lista.' })
  }
  return toFieldErrors(issues)
}

// Spec 019 (D3): public projects run by stages, so the app always asks for Scrum (its sprints are the stages)
// and never shows a methodology choice. Six months is a typical public contract.
export const PROJECT_DEFAULTS = { duration_weeks: 26, requested_methodology: 'scrum' as const, auto_approve: false }

// ---------- Capacity (spec 002, domain/capacity.py: the single rule, spec 003 FR-017) ----------

export const HOURS_PER_POINT: Record<Seniority, number> = { junior: 8, mid: 6, senior: 4 }

export const memberCapacity = (member: Pick<Member, 'hours_per_week' | 'seniority'>, sprintWeeks: number) =>
  Math.floor((member.hours_per_week * sprintWeeks) / HOURS_PER_POINT[member.seniority])

export const teamCapacity = (members: Pick<Member, 'hours_per_week' | 'seniority'>[], sprintWeeks: number) =>
  members.reduce((total, member) => total + memberCapacity(member, sprintWeeks), 0)

export function sprintLoad(tasks: Task[], sprintId: number, capacity: number): SprintLoad {
  const points = tasks.filter((t) => t.sprint_id === sprintId).reduce((total, t) => total + t.points, 0)
  return { points, capacity, overloaded: points > capacity }
}

// ---------- Columns and moves (spec 003) ----------

export const BOARD_COLUMNS: readonly TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
export const CONTINUOUS_COLUMNS: readonly TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']

/** Tasks of one column (same sprint and status), in board order. */
export const columnTasks = (tasks: Task[], status: TaskStatus, sprintId: number | null) =>
  tasks.filter((t) => t.status === status && t.sprint_id === sprintId).sort((a, b) => a.position - b.position)

export interface MoveTarget {
  status: TaskStatus
  position: number
  sprint_id?: number | null
}

/** Moves a task and compacts the positions of the columns it left and entered. Returns new task objects. */
export function moveTask(tasks: Task[], taskId: number, target: MoveTarget): Task[] {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return tasks
  const sprintId = target.sprint_id === undefined ? task.sprint_id : target.sprint_id
  const source = columnTasks(tasks, task.status, task.sprint_id).filter((t) => t.id !== taskId)
  const destination = columnTasks(tasks, target.status, sprintId).filter((t) => t.id !== taskId)
  const index = Math.max(0, Math.min(target.position, destination.length))
  destination.splice(index, 0, { ...task, status: target.status, sprint_id: sprintId })

  const placed = new Map<number, Task>()
  source.forEach((t, i) => placed.set(t.id, { ...t, position: i }))
  destination.forEach((t, i) => placed.set(t.id, { ...t, position: i }))
  return tasks.map((t) => placed.get(t.id) ?? t)
}

/** Columns over their WIP limit, counted inside one sprint (or the whole continuous board). Never blocking. */
export function wipWarnings(tasks: Task[], limits: WipLimit[], sprintId: number | null): BoardWarning[] {
  return limits.flatMap(({ column, limit }) => {
    const count = tasks.filter((t) => t.status === column && t.sprint_id === sprintId).length
    return count > limit ? [{ code: 'wip_limit_exceeded' as const, column, limit, count }] : []
  })
}

export const wipLimitOf = (limits: WipLimit[], status: TaskStatus) => limits.find((l) => l.column === status)?.limit ?? null

/** "US-" plus one more than the highest "US-N" key; other key shapes are ignored (spec 014, as the service does). */
export function nextTaskKey(tasks: Pick<Task, 'key'>[]): string {
  const numbers = tasks.map((t) => /^US-(\d+)$/.exec(t.key)?.[1]).filter((n): n is string => n !== undefined).map(Number)
  return `US-${Math.max(0, ...numbers) + 1}`
}

// ---------- Checklist (spec 003) ----------

export function checklistProgress(items: ChecklistItem[]) {
  const done = items.filter((i) => i.done).length
  return { done, total: items.length, complete: items.length > 0 && done === items.length }
}

/** A finished checklist on a task in progress suggests moving it to review, without moving it. */
export const suggestsAdvance = (task: Pick<Task, 'status' | 'checklist'>) =>
  task.status === 'in_progress' && checklistProgress(task.checklist).complete

// ---------- Sprints ----------

/** The sprint the board opens on: the first one with unfinished work, else the last one. */
export function defaultSprint(sprints: Sprint[], tasks: Task[]): Sprint | null {
  const ordered = [...sprints].sort((a, b) => a.number - b.number)
  return ordered.find((s) => !s.closed && tasks.some((t) => t.sprint_id === s.id && t.status !== 'done')) ?? ordered.at(-1) ?? null
}

// ---------- Filters (kept in the URL) ----------

export interface TaskFilters {
  assignee?: number | 'none'
  priority?: Priority
  epic?: string
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(
    (t) =>
      (filters.assignee === undefined || (filters.assignee === 'none' ? t.assignee_id === null : t.assignee_id === filters.assignee)) &&
      (filters.priority === undefined || t.priority === filters.priority) &&
      (filters.epic === undefined || t.epic_key === filters.epic),
  )
}

export const activeFilterCount = (filters: TaskFilters) =>
  [filters.assignee, filters.priority, filters.epic].filter((value) => value !== undefined).length

/** What a task added on a filtered board takes from the filters, so it doesn't vanish from it (spec 014, FR-003). */
export function fieldsFromFilters(filters: TaskFilters): Pick<NewTask, 'assignee_id' | 'priority' | 'epic_key'> {
  return {
    ...(typeof filters.assignee === 'number' && { assignee_id: filters.assignee }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.epic && { epic_key: filters.epic }),
  }
}
