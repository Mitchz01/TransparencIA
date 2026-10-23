import { describe, expect, it } from 'vitest'
import { firstName, recentProjects, suggestProjectName } from './launchpad'

describe('recentProjects', () => {
  const projects = [
    { id: 1, created_at: '2026-10-01T10:00:00Z' },
    { id: 2, created_at: '2026-10-20T10:00:00Z' },
    { id: 3, created_at: '2026-10-10T10:00:00Z' },
  ]

  it('orders newest first and keeps the first ones', () => {
    expect(recentProjects(projects).map((p) => p.id)).toEqual([2, 3, 1])
    expect(recentProjects(projects, 2).map((p) => p.id)).toEqual([2, 3])
  })

  it('leaves the input as it was', () => {
    recentProjects(projects)
    expect(projects.map((p) => p.id)).toEqual([1, 2, 3])
  })
})

describe('suggestProjectName', () => {
  it('takes the first five words without the article', () => {
    expect(suggestProjectName('Una app de citas para clínicas veterinarias con recordatorios')).toBe('App de citas para clínicas')
  })

  it('capitalizes and drops trailing punctuation', () => {
    expect(suggestProjectName('  marketplace de artesanos, ')).toBe('Marketplace de artesanos')
    expect(suggestProjectName('¿Un SaaS?')).toBe('Un SaaS')
  })

  it('is empty for an empty description', () => {
    expect(suggestProjectName('   ')).toBe('')
  })
})

describe('firstName', () => {
  it('takes the first word or nothing', () => {
    expect(firstName('Ana Gómez')).toBe('Ana')
    expect(firstName('  ')).toBeNull()
    expect(firstName(null)).toBeNull()
  })
})
