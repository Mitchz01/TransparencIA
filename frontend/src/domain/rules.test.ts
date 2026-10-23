import { describe, expect, it } from 'vitest'
import type { ProjectCreate } from './project'
import { MEMBER_DEFAULTS, PROJECT_DEFAULTS, validateProject } from './rules'

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
    expect(validateProject({ ...valid, name: '  ', description: '' })).toEqual({ name: 'Required.', description: 'Required.' })
  })

  it('limits the name to 120 characters and the description to 5000', () => {
    const errors = validateProject({ ...valid, name: 'x'.repeat(121), description: 'y'.repeat(5001) })
    expect(errors.name).toBe('Max 120 characters.')
    expect(errors.description).toBe('Max 5000 characters.')
  })

  it('keeps the duration between 1 and 52 whole weeks', () => {
    expect(validateProject({ ...valid, duration_weeks: 0 }).duration_weeks).toBe('Must be between 1 and 52.')
    expect(validateProject({ ...valid, duration_weeks: 53 }).duration_weeks).toBe('Must be between 1 and 52.')
    expect(validateProject({ ...valid, duration_weeks: 2.5 }).duration_weeks).toBe('Must be between 1 and 52.')
    expect(validateProject({ ...valid, duration_weeks: 52 })).toEqual({})
  })

  it('only accepts a methodology of the list', () => {
    expect(validateProject({ ...valid, requested_methodology: 'waterfall' as never }).requested_methodology).toBe('Pick one of the list.')
  })

  it('needs at least one member', () => {
    expect(validateProject({ ...valid, members: [] }).members).toBe('The team needs at least one member.')
  })

  it('flags a repeated name on the second row, ignoring case and spaces', () => {
    const errors = validateProject({ ...valid, members: [{ name: 'Ana', role: 'Backend' }, { name: ' ana ', role: 'QA' }] })
    expect(errors).toEqual({ 'members[1].name': 'Duplicated name.' })
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
      'members[0].role': 'Required.',
      'members[0].hours_per_week': 'Must be between 1 and 60.',
      'members[1].role': 'Max 60 characters.',
      'members[1].hours_per_week': 'Must be between 1 and 60.',
      'members[1].skills[0]': 'Max 40 characters.',
    })
  })

  it('validates only the fields an update sends', () => {
    expect(validateProject({ auto_approve: true })).toEqual({})
    expect(validateProject({ name: '' })).toEqual({ name: 'Required.' })
  })

  it('fills the same defaults as the service', () => {
    expect(MEMBER_DEFAULTS).toEqual({ seniority: 'mid', hours_per_week: 20 })
    expect(PROJECT_DEFAULTS).toEqual({ duration_weeks: 8, requested_methodology: 'auto', auto_approve: false })
  })
})
