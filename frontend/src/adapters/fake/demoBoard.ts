// The fake version of spec 003's build_board(): turns an approved plan into sprints, objectives and tasks.
// Assignment by name, then by role with the fewest points, else flagged with the missing role.

import type { BoardView, Sprint, Task } from '../../domain/board'
import type { StageOutputs } from '../../domain/plan'
import type { Member } from '../../domain/project'
import { sprintLoad, teamCapacity } from '../../domain/rules'

const DAY = 24 * 60 * 60 * 1000

export function buildBoard(
  projectId: number,
  members: Member[],
  plan: Pick<StageOutputs, 'methodology' | 'backlog' | 'sprints'>,
  nextId: () => number,
  startedAt: string,
): BoardView {
  const weeks = plan.methodology.sprint_length_weeks
  const continuous = plan.methodology.methodology === 'kanban'
  const capacity = teamCapacity(members, weeks)
  const start = new Date(startedAt).getTime()

  const sprints: Sprint[] = continuous
    ? []
    : plan.sprints.sprints.map((s) => ({
        id: nextId(), number: s.number, name: s.name, goal: s.goal, phase: s.phase, load: null, closed: false,
        end_date: new Date(start + s.number * weeks * 7 * DAY).toISOString().slice(0, 10),
      }))

  const sprintOf = (key: string) => {
    const index = plan.sprints.sprints.findIndex((s) => s.story_keys.includes(key))
    return index < 0 ? undefined : index
  }
  const load = new Map<number, number>()
  const assign = (role: string, name: string | undefined, points: number): Member | undefined => {
    const byName = members.find((m) => m.name.toLowerCase() === name?.toLowerCase())
    const byRole = members
      .filter((m) => m.role.toLowerCase() === role.toLowerCase())
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))[0]
    const member = byName ?? byRole
    if (member) load.set(member.id, (load.get(member.id) ?? 0) + points)
    return member
  }

  const positions = new Map<string, number>()
  const tasks: Task[] = plan.backlog.stories.map((story) => {
    const index = sprintOf(story.key)
    const sprint = index === undefined ? null : sprints[index] ?? null
    const status = continuous ? (index === 0 ? 'todo' : 'backlog') : sprint ? 'todo' : 'backlog'
    const column = `${sprint?.id ?? 'none'}:${status}`
    const position = positions.get(column) ?? 0
    positions.set(column, position + 1)
    const member = assign(story.role, plan.sprints.assignments.find((a) => a.story_key === story.key)?.member_name, story.points)
    return {
      id: nextId(), project_id: projectId, sprint_id: sprint?.id ?? null, assignee_id: member?.id ?? null,
      key: story.key, epic_key: story.epic_key, title: story.title, description: story.description,
      acceptance_criteria: story.acceptance_criteria,
      checklist: story.acceptance_criteria.map((text) => ({ text, done: false })),
      type: story.type, points: story.points, priority: story.priority, status, position,
      missing_role: member ? null : story.role, issue: null,
    }
  })

  for (const sprint of sprints) sprint.load = sprintLoad(tasks, sprint.id, capacity)

  return {
    project_id: projectId,
    continuous,
    wip_limits: plan.methodology.wip_limits,
    capacity_override: null,
    sprints,
    objectives: sprints.map((s) => ({ id: nextId(), sprint_id: s.id, title: s.goal, done: false })),
    tasks,
  }
}
