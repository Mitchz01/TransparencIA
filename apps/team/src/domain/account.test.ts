import { describe, expect, it } from 'vitest'
import {
  canManage, cleanGithubUsername, invitationLink, isLastLeader, myMember, normalizeEmail, uniqueName,
  validateMemberUpdate, validateProfile, validateSignIn, validateSignUp,
} from './account'
import type { Member } from './project'

const member = (id: number, permission: Member['permission'], account_id: number | null = id): Member => ({
  id, name: `M${id}`, role: 'Backend', seniority: 'mid', hours_per_week: 20, skills: [], account_id, permission,
})

describe('validateSignUp (spec 015, FR-001)', () => {
  it('accepts a name, an email and an 8+ character password', () => {
    expect(validateSignUp({ name: 'Ana', email: 'ana@team.dev', password: '12345678' })).toEqual([])
  })

  it('names every failing field with the service’s limits', () => {
    expect(validateSignUp({ name: ' ', email: 'ana', password: '1234567' })).toEqual([
      { field: 'name', message: 'Obligatorio.' },
      { field: 'email', message: 'Escribe un email válido.' },
      { field: 'password', message: 'Usa al menos 8 caracteres.' },
    ])
    expect(validateSignUp({ name: 'n'.repeat(121), email: `${'a'.repeat(250)}@x.dev`, password: 'p'.repeat(129) })).toEqual([
      { field: 'name', message: 'Máximo 120 caracteres.' },
      { field: 'email', message: 'Máximo 254 caracteres.' },
      { field: 'password', message: 'Máximo 128 caracteres.' },
    ])
  })

  it('ignores case and surrounding spaces in the email', () => {
    expect(normalizeEmail('  Ana@Team.dev ')).toBe('ana@team.dev')
    expect(validateSignUp({ name: 'Ana', email: ' ANA@team.dev ', password: '12345678' })).toEqual([])
  })
})

describe('validateSignIn', () => {
  it('only asks for both fields, never says which one is wrong', () => {
    expect(validateSignIn({ email: '', password: '' })).toHaveLength(2)
    expect(validateSignIn({ email: 'x', password: 'y' })).toEqual([])
  })
})

describe('validateProfile (spec 015, FR-005)', () => {
  it('checks only the fields it gets', () => {
    expect(validateProfile({})).toEqual([])
    expect(validateProfile({ role: null, github_username: null })).toEqual([])
  })

  it('uses spec 001’s member limits', () => {
    expect(validateProfile({ name: '', role: 'r'.repeat(61), hours_per_week: 61, skills: ['ok', 's'.repeat(41)] })).toEqual([
      { field: 'name', message: 'Obligatorio.' },
      { field: 'role', message: 'Máximo 60 caracteres.' },
      { field: 'hours_per_week', message: 'Debe estar entre 1 y 60.' },
      { field: 'skills[1]', message: 'Máximo 40 caracteres.' },
    ])
  })

  it('follows GitHub’s username rule and drops a leading @', () => {
    expect(cleanGithubUsername(' @ana-g ')).toBe('ana-g')
    expect(validateProfile({ github_username: '@ana-g' })).toEqual([])
    expect(validateProfile({ github_username: 'ana--g' })).toHaveLength(1)
    expect(validateProfile({ github_username: '-ana' })).toHaveLength(1)
    expect(validateProfile({ github_username: 'a'.repeat(40) })).toHaveLength(1)
  })
})

describe('validateMemberUpdate', () => {
  it('never lets the role be empty', () => {
    expect(validateMemberUpdate({ role: ' ' })).toEqual([{ field: 'role', message: 'Obligatorio.' }])
    expect(validateMemberUpdate({ permission: 'leader' })).toEqual([])
  })
})

describe('permissions (spec 015, US5)', () => {
  const project = { members: [member(1, 'leader'), member(2, 'member'), member(3, 'member', null)] }

  it('finds my member by account', () => {
    expect(myMember(project, { id: 2 })?.id).toBe(2)
    expect(myMember(project, { id: 9 })).toBeUndefined()
    expect(myMember(project, null)).toBeUndefined()
  })

  it('lets only leaders manage', () => {
    expect(canManage(project, { id: 1 })).toBe(true)
    expect(canManage(project, { id: 2 })).toBe(false)
    expect(canManage(project, { id: 9 })).toBe(false)
    expect(canManage(project, undefined)).toBe(false)
  })

  it('knows the last leader', () => {
    expect(isLastLeader(project, 1)).toBe(true)
    expect(isLastLeader(project, 2)).toBe(false)
    expect(isLastLeader({ members: [member(1, 'leader'), member(2, 'leader')] }, 1)).toBe(false)
  })
})

describe('uniqueName (FR-011)', () => {
  it('adds a number when the name is taken, ignoring case and spaces', () => {
    expect(uniqueName('Ana Gómez', ['Leo'])).toBe('Ana Gómez')
    expect(uniqueName('Ana Gómez', [' ana  gómez '])).toBe('Ana Gómez 2')
    expect(uniqueName('Ana Gómez', ['Ana Gómez', 'Ana Gómez 2'])).toBe('Ana Gómez 3')
  })
})

it('builds the invitation link from the origin', () => {
  expect(invitationLink('https://agile.dev', 'k3Jx')).toBe('https://agile.dev/join/k3Jx')
})
