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
