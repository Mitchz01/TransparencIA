import { describe, expect, it } from 'vitest'
import type { Architecture } from './plan'
import { groupByLayer, orderCeremonies } from './planViews'

const ceremony = (name: string) => ({ name, frequency: '', purpose: '' })

describe('orderCeremonies', () => {
  it('puts the ceremonies in the order they happen in an iteration', () => {
    const names = orderCeremonies(['Retro', 'Daily', 'Sprint review', 'Planning'].map(ceremony)).map((c) => c.name)
    expect(names).toEqual(['Planning', 'Daily', 'Sprint review', 'Retro'])
  })

  it('keeps unknown ceremonies in the agent order, after the known ones', () => {
    const names = orderCeremonies(['Refinamiento', 'Retro', 'Pairing', 'Planificación'].map(ceremony)).map((c) => c.name)
    expect(names).toEqual(['Planificación', 'Retro', 'Refinamiento', 'Pairing'])
  })
})

describe('groupByLayer', () => {
  const architecture = (stack: [string, string][], components: [string, string][]): Architecture => ({
    style: 'Monolito',
    summary: '',
    stack: stack.map(([layer, technology]) => ({ layer, technology, reason: '' })),
    components: components.map(([name, technology]) => ({ name, technology, responsibility: '' })),
    decisions: [],
  })

  it('puts each component in the layer that shares a technology word, and the rest last', () => {
    const groups = groupByLayer(architecture(
      [['Frontend', 'React + Tailwind'], ['Backend', 'FastAPI'], ['IA', 'Gemini']],
      [['App web', 'React + Vite'], ['API', 'FastAPI'], ['Agentes', 'Gemini'], ['Base de datos', 'SQLite']],
    ))
    expect(groups.map((g) => [g.layer?.layer ?? null, g.components.map((c) => c.name)])).toEqual([
      ['Frontend', ['App web']],
      ['Backend', ['API']],
      ['IA', ['Agentes']],
      [null, ['Base de datos']],
    ])
  })

  it('has no last group when every component found its layer, and keeps empty layers', () => {
    const groups = groupByLayer(architecture([['Frontend', 'React'], ['Datos', 'PostgreSQL']], [['App', 'react']]))
    expect(groups.map((g) => [g.layer?.layer, g.components.length])).toEqual([['Frontend', 1], ['Datos', 0]])
  })

  it('puts everything in one group without a layer when there is no stack', () => {
    const groups = groupByLayer(architecture([], [['App', 'React']]))
    expect(groups).toEqual([{ layer: null, components: [expect.objectContaining({ name: 'App' })] }])
  })
})
