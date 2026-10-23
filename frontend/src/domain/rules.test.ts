import { describe, expect, it } from 'vitest'
import type { Task } from './board'
import type { ProjectCreate } from './project'
import {
  MEMBER_DEFAULTS, PROJECT_DEFAULTS, activeFilterCount, checklistProgress, columnTasks, defaultSprint, fieldsFromFilters, filterTasks,
  memberCapacity, moveTask, nextTaskKey, sprintLoad, suggestsAdvance, teamCapacity, validateProject, wipWarnings,
} from './rules'

const valid: ProjectCreate = {
  name: 'Shop',
  description: 'A small online shop.',
  members: [
    { name: 'Ana', role: 'Backend', seniority: 'senior', hours_per_week: 30 },
    { name: 'Leo', role: 'Frontend' },
  ],
}

describe('validateProject (project form)', () => {
  it('accepts a valid project', () => {
    expect(validateProject(valid)).toEqual({})
  })

  it('requires the name and the description', () => {
    expect(validateProject({ ...valid, name: '  ', description: '' })).toEqual({ name: 'Obligatorio.', description: 'Obligatorio.' })
  })

  it('limits the name to 120 characters and the description to 5000', () => {
    const errors = validateProject({ ...valid, name: 'x'.repeat(121), description: 'y'.repeat(5001) })
    expect(errors.name).toBe('Máximo 120 caracteres.')
    expect(errors.description).toBe('Máximo 5000 caracteres.')
  })

  it('keeps the duration between 1 and 52 whole weeks', () => {
    expect(validateProject({ ...valid, duration_weeks: 0 }).duration_weeks).toBe('Debe estar entre 1 y 52.')
    expect(validateProject({ ...valid, duration_weeks: 53 }).duration_weeks).toBe('Debe estar entre 1 y 52.')
    expect(validateProject({ ...valid, duration_weeks: 2.5 }).duration_weeks).toBe('Debe estar entre 1 y 52.')
    expect(validateProject({ ...valid, duration_weeks: 52 })).toEqual({})
  })

  it('only accepts a methodology of the list', () => {
    expect(validateProject({ ...valid, requested_methodology: 'waterfall' as never }).requested_methodology).toBe('Elige una opción de la lista.')
  })

  it('needs at least one member', () => {
    expect(validateProject({ ...valid, members: [] }).members).toBe('El equipo necesita al menos un miembro.')
  })

  it('flags a repeated name on the second row, ignoring case and spaces', () => {
    const errors = validateProject({ ...valid, members: [{ name: 'Ana', role: 'Backend' }, { name: ' ana ', role: 'QA' }] })
    expect(errors).toEqual({ 'members[1].name': 'Nombre repetido.' })
  })

  it('checks each member row by its path', () => {
    const errors = validateProject({
      ...valid,
      members: [
        { name: 'Ana', role: '', hours_per_week: 61 },
        { name: 'Leo', role: 'r'.repeat(61), hours_per_week: 0, skills: ['s'.repeat(41)] },
      ],
    })
    expect(errors).toEqual({
      'members[0].role': 'Obligatorio.',
      'members[0].hours_per_week': 'Debe estar entre 1 y 60.',
      'members[1].role': 'Máximo 60 caracteres.',
      'members[1].hours_per_week': 'Debe estar entre 1 y 60.',
      'members[1].skills[0]': 'Máximo 40 caracteres.',
    })
  })

  it('validates only the fields an update sends', () => {
    expect(validateProject({ auto_approve: true })).toEqual({})
    expect(validateProject({ name: '' })).toEqual({ name: 'Obligatorio.' })
  })

  it('fills the same defaults as the service', () => {
    expect(MEMBER_DEFAULTS).toEqual({ seniority: 'mid', hours_per_week: 20 })
    expect(PROJECT_DEFAULTS).toEqual({ duration_weeks: 8, requested_methodology: 'auto', auto_approve: false })
  })
})

// ---------- Board rules (spec 003) ----------

let nextId = 1
const task = (change: Partial<Task> = {}): Task => ({
  id: nextId++, project_id: 1, sprint_id: 10, assignee_id: null, key: `US-${nextId}`, epic_key: 'EP-1', title: 'Task',
  description: '', acceptance_criteria: [], checklist: [], type: 'feature', points: 3, priority: 'medium', status: 'todo',
  position: 0, missing_role: null, issue: null, ...change,
})

describe('moveTask', () => {
  it('moves a task to another column at a position and compacts both columns', () => {
    const [a, b, c, d] = [task({ position: 0 }), task({ position: 1 }), task({ status: 'in_progress', position: 0 }), task({ status: 'in_progress', position: 1 })]
    const moved = moveTask([a, b, c, d], a.id, { status: 'in_progress', position: 1 })
    expect(columnTasks(moved, 'todo', 10).map((t) => [t.id, t.position])).toEqual([[b.id, 0]])
    expect(columnTasks(moved, 'in_progress', 10).map((t) => t.id)).toEqual([c.id, a.id, d.id])
    expect(columnTasks(moved, 'in_progress', 10).map((t) => t.position)).toEqual([0, 1, 2])
  })

  it('reorders inside a column', () => {
    const [a, b, c] = [task({ position: 0 }), task({ position: 1 }), task({ position: 2 })]
    expect(columnTasks(moveTask([a, b, c], c.id, { status: 'todo', position: 0 }), 'todo', 10).map((t) => t.id)).toEqual([c.id, a.id, b.id])
  })
})

describe('wipWarnings', () => {
  const limits = [{ column: 'in_progress' as const, limit: 2 }]

  it('warns only when a column goes over its limit, inside the sprint', () => {
    const atLimit = [task({ status: 'in_progress' }), task({ status: 'in_progress' }), task({ status: 'in_progress', sprint_id: 11 })]
    expect(wipWarnings(atLimit, limits, 10)).toEqual([])
    const over = [...atLimit, task({ status: 'in_progress' })]
    expect(wipWarnings(over, limits, 10)).toEqual([{ code: 'wip_limit_exceeded', column: 'in_progress', limit: 2, count: 3 }])
  })
})

describe('sprintLoad and capacity', () => {
  it('adds the points of the sprint and flags it when it goes over the capacity', () => {
    const tasks = [task({ points: 8 }), task({ points: 5 }), task({ points: 13, sprint_id: 11 })]
    expect(sprintLoad(tasks, 10, 13)).toEqual({ points: 13, capacity: 13, overloaded: false })
    expect(sprintLoad(tasks, 10, 12)).toEqual({ points: 13, capacity: 12, overloaded: true })
  })

  it('counts each member by hours, seniority and sprint length (spec 002 rule)', () => {
    expect(memberCapacity({ hours_per_week: 30, seniority: 'senior' }, 2)).toBe(15)
    expect(memberCapacity({ hours_per_week: 20, seniority: 'mid' }, 2)).toBe(6)
    expect(teamCapacity([{ hours_per_week: 30, seniority: 'senior' }, { hours_per_week: 20, seniority: 'junior' }], 2)).toBe(20)
  })
})

describe('checklistProgress', () => {
  it('counts done items and knows when the checklist is complete', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, complete: false })
    expect(checklistProgress([{ text: 'a', done: true }, { text: 'b', done: false }])).toEqual({ done: 1, total: 2, complete: false })
    expect(checklistProgress([{ text: 'a', done: true }])).toEqual({ done: 1, total: 1, complete: true })
  })

  it('suggests moving to review only for a task in progress with everything checked', () => {
    const items = [{ text: 'a', done: true }]
    expect(suggestsAdvance({ status: 'in_progress', checklist: items })).toBe(true)
    expect(suggestsAdvance({ status: 'todo', checklist: items })).toBe(false)
  })
})

describe('filterTasks', () => {
  it('filters by assignee, unassigned, priority and epic', () => {
    const tasks = [task({ assignee_id: 1, priority: 'high' }), task({ assignee_id: null, epic_key: 'EP-2' }), task({ assignee_id: 2 })]
    expect(filterTasks(tasks, { assignee: 1 })).toEqual([tasks[0]])
    expect(filterTasks(tasks, { assignee: 'none' })).toEqual([tasks[1]])
    expect(filterTasks(tasks, { priority: 'high' })).toEqual([tasks[0]])
    expect(filterTasks(tasks, { epic: 'EP-2' })).toEqual([tasks[1]])
    expect(filterTasks(tasks, {})).toHaveLength(3)
  })
})

describe('defaultSprint', () => {
  it('opens the first sprint with unfinished work', () => {
    const sprints = [1, 2, 3].map((n) => ({ id: n * 10, number: n, name: `Sprint ${n}`, goal: '', phase: '', load: null, closed: false, end_date: null }))
    expect(defaultSprint(sprints, [task({ sprint_id: 10, status: 'done' }), task({ sprint_id: 20 })])?.number).toBe(2)
    expect(defaultSprint(sprints, [])?.number).toBe(3)
  })
})

describe('new tasks (spec 014)', () => {
  it('take the key after the highest US-N, ignoring other shapes', () => {
    expect(nextTaskKey([{ key: 'US-1' }, { key: 'US-12' }, { key: 'BUG-40' }])).toBe('US-13')
    expect(nextTaskKey([{ key: 'BUG-3' }])).toBe('US-1')
  })

  it('take the active filters, never "Sin asignar"', () => {
    expect(fieldsFromFilters({ assignee: 3, priority: 'high', epic: 'EP-1' })).toEqual({ assignee_id: 3, priority: 'high', epic_key: 'EP-1' })
    expect(fieldsFromFilters({ assignee: 'none' })).toEqual({})
    expect(activeFilterCount({ assignee: 'none', priority: 'low' })).toBe(2)
    expect(activeFilterCount({})).toBe(0)
  })
})
