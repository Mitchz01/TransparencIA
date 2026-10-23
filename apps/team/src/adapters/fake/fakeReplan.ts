// The fake replanner (spec 008): looks at the board and proposes concrete changes, each with its reason.
// Applying skips any change whose task moved since the proposal (expected_status).

import type { BoardView, Task } from '../../domain/board'
import type { Project } from '../../domain/project'
import type { ReplanChange, ReplanContent } from '../../domain/proposalContent'
import { defaultSprint, sprintLoad, teamCapacity } from '../../domain/rules'

export function proposeReplan(project: Project, board: BoardView, reason: string): ReplanContent {
  const changes: ReplanChange[] = []
  const sprints = [...board.sprints].sort((a, b) => a.number - b.number)
  const current = defaultSprint(sprints.filter((s) => !s.closed), board.tasks) ?? sprints[0]
  const next = sprints.find((s) => s.number > (current?.number ?? 0) && !s.closed)

  const open = board.tasks.filter((t) => t.sprint_id === current?.id && (t.status === 'todo' || t.status === 'in_progress'))
  const heaviest = [...open].sort((a, b) => b.points - a.points)[0]
  if (heaviest && next) {
    changes.push({ kind: 'move', task_key: heaviest.key, to_sprint: next.number, expected_status: heaviest.status, rationale: `Es la más grande de ${current!.name} y no llega a tiempo; pasa a ${next.name}.` })
  }
  const orphan = board.tasks.find((t) => t.missing_role && t.status !== 'done')
  const helper = project.members[0]
  if (orphan && helper) {
    changes.push({ kind: 'reassign', task_key: orphan.key, to_member: helper.name, expected_status: orphan.status, rationale: `Nadie tiene el rol ${orphan.missing_role}; ${helper.name} es quien más se acerca.` })
  }
  if (next) {
    changes.push({
      kind: 'add', to_sprint: next.number, rationale: 'Cubre lo que pediste en el motivo.',
      new_story: {
        key: `US-${board.tasks.length + 1}`, epic_key: board.tasks[0]?.epic_key ?? 'EP-1', title: `Atender: ${reason.slice(0, 60)}`,
        description: `Como líder quiero ${reason.slice(0, 80).toLowerCase()} para mantener el plan al día.`,
        acceptance_criteria: ['El equipo lo revisa en la próxima planning'], type: 'chore', points: 2, priority: 'medium', role: helper?.role ?? 'Backend',
      },
    })
  }
  const optional = board.tasks.find((t) => t.priority === 'low' && t.status !== 'done' && t.status !== 'in_progress')
  if (optional) {
    changes.push({ kind: 'discard', task_key: optional.key, expected_status: optional.status, rationale: 'Prioridad baja y sin avance: libera capacidad para lo urgente.' })
  }
  return { changes, rationale: `Con tu motivo ("${reason}"), se alivia la etapa actual y se ordena lo que queda.` }
}

/** Applies what still makes sense; returns the keys applied and the ones skipped with their reason. */
export function applyReplan(project: Project, board: BoardView, content: ReplanContent, nextId: () => number) {
  const applied: string[] = []
  const discarded: { task_key: string; reason: string }[] = []
  const sprintOf = (number: number) => board.sprints.find((s) => s.number === number)
  let tasks = [...board.tasks]
  const find = (key: string) => tasks.find((t) => t.key === key)
  const stillAs = (task: Task | undefined, status: Task['status'], key: string) => {
    if (task && task.status === status) return true
    discarded.push({ task_key: key, reason: 'La tarea cambió desde la propuesta.' })
    return false
  }
  const endOf = (sprintId: number | null, status: Task['status']) => tasks.filter((t) => t.sprint_id === sprintId && t.status === status).length

  for (const change of content.changes) {
    if (change.kind === 'add') {
      const sprint = sprintOf(change.to_sprint)
      const s = change.new_story
      const member = project.members.find((m) => m.role.toLowerCase() === s.role.toLowerCase())
      tasks.push({
        id: nextId(), project_id: project.id, sprint_id: sprint?.id ?? null, assignee_id: member?.id ?? null, key: s.key, epic_key: s.epic_key,
        title: s.title, description: s.description, acceptance_criteria: s.acceptance_criteria, checklist: s.acceptance_criteria.map((text) => ({ text, done: false })),
        type: s.type, points: s.points, priority: s.priority, status: sprint ? 'todo' : 'backlog', position: endOf(sprint?.id ?? null, 'todo'),
        missing_role: member ? null : s.role, issue: null,
      })
      applied.push(s.key)
      continue
    }
    const task = find(change.task_key)
    if (!stillAs(task, change.expected_status, change.task_key)) continue
    if (change.kind === 'move') {
      const sprint = sprintOf(change.to_sprint)
      tasks = tasks.map((t) => (t.key === change.task_key ? { ...t, sprint_id: sprint?.id ?? null, status: 'todo', position: endOf(sprint?.id ?? null, 'todo') } : t))
    } else if (change.kind === 'reassign') {
      const member = project.members.find((m) => m.name === change.to_member)
      tasks = tasks.map((t) => (t.key === change.task_key ? { ...t, assignee_id: member?.id ?? t.assignee_id, missing_role: member ? null : t.missing_role } : t))
    } else {
      tasks = tasks.filter((t) => t.key !== change.task_key)
    }
    applied.push(change.task_key)
  }

  const weeks = project.plan?.methodology?.sprint_length_weeks ?? 2
  const capacity = board.capacity_override ?? teamCapacity(project.members, weeks)
  const sprints = board.sprints.map((s) => ({ ...s, load: board.continuous ? null : sprintLoad(tasks, s.id, capacity) }))
  return { board: { ...board, tasks, sprints }, applied, discarded }
}
