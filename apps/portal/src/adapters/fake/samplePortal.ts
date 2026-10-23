// The demo project's portal (specs/017-transparency-portal/team/README.md, same numbers) for the fake gateway,
// until P4's fixture (@agile/domain/fixtures) is written. Once it is, the fake gateway uses that one.

import type { Portal, WeekEntry } from '@agile/domain'

const TASKS: Record<number, { id: number; title: string }[]> = {
  1: [{ id: 1, title: 'Diagnóstico del sitio' }],
  2: [{ id: 2, title: 'Socialización con la comunidad' }],
  3: [{ id: 3, title: 'Comprar plántulas' }],
  5: [{ id: 4, title: 'Adecuar el vivero' }],
  7: [{ id: 5, title: 'Sembrar lote 1 (1 ha)' }],
  9: [{ id: 6, title: 'Primer taller comunitario' }],
}
const SPENT: Record<number, number> = { 3: 30_000_000, 9: 2_400_000 }
const CONTRACT = 180_000_000
const POINTS_PER_TASK = 3.7 // 6 tasks done of ~49 points: 22 % at week 12

function timeline(): WeekEntry[] {
  let spent = 0
  let done = 0
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(Date.UTC(2026, 7, 3 + i * 7))
    spent += SPENT[i] ?? 0
    done += (TASKS[i]?.length ?? 0) * POINTS_PER_TASK
    return {
      week_start: start.toISOString().slice(0, 10),
      tasks_done: TASKS[i] ?? [],
      spent: SPENT[i] ?? 0,
      spent_pct_acc: Math.round((spent / CONTRACT) * 1000) / 10,
      physical_pct_acc: Math.round(done * 10) / 10,
    }
  })
}

export const samplePortal = (): Portal => ({
  project: {
    name: 'Restauración de manglar en la Ciénaga Grande',
    description:
      'Restauración de 5 ha de manglar en la Ciénaga Grande de Santa Marta: vivero, siembra, mantenimiento, monitoreo y talleres con la comunidad.',
    contracting_entity: 'Corpamag',
    contractor: 'Fundación Manglares Vivos',
    contract_value: CONTRACT,
    start_date: '2026-08-03',
    end_date: '2027-02-01',
  },
  summary: {
    spent: 32_400_000,
    spent_pct: 18,
    physical_pct: 22.2,
    time_pct: 44.5,
    unallocated: 0,
    light: 'yellow',
    reasons: [
      'Hay 1 alerta de nivel medio en revisión',
      'El tiempo transcurrido (44,5 %) va 22 puntos por delante del avance (22,2 %)',
    ],
  },
  lines: [
    { id: 'R1', name: 'Plántulas de mangle', amount: 45_000_000, spent: 32_400_000, available: 12_600_000 },
    { id: 'R2', name: 'Mano de obra local', amount: 70_000_000, spent: 0, available: 70_000_000 },
    { id: 'R3', name: 'Logística y transporte fluvial', amount: 30_000_000, spent: 0, available: 30_000_000 },
    { id: 'R4', name: 'Monitoreo y talleres comunitarios', amount: 35_000_000, spent: 0, available: 35_000_000 },
  ],
  timeline: timeline(),
  sprints: [],
  expenses: [
    {
      id: 3, kind: 'invoice', status: 'confirmed', file_url: '/favicon.svg', mime: 'application/pdf',
      amount: 2_400_000, date: '2026-10-02', supplier: 'Restaurante El Muelle', concept: 'Almuerzos',
      budget_line_id: 'R1', task_id: null, task_title: null,
      citizen_summary: 'Almuerzos para el equipo de campo.',
      alerts: [{
        id: 1, expense_id: 3, level: 'medium', source: 'ai', answer: null, answered_at: null,
        reason: 'El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.',
      }],
      created_at: '2026-10-02T15:00:00Z',
    },
    {
      id: 2, kind: 'field_photo', status: 'confirmed', file_url: '/favicon.svg', mime: 'image/svg+xml',
      amount: null, date: '2026-09-15', supplier: null, concept: 'Siembra de la primera hectárea',
      budget_line_id: 'R2', task_id: 5, task_title: 'Sembrar lote 1 (1 ha)',
      citizen_summary: 'Siembra de la primera hectárea de mangle rojo.', alerts: [], created_at: '2026-09-15T15:00:00Z',
    },
    {
      id: 1, kind: 'invoice', status: 'confirmed', file_url: '/favicon.svg', mime: 'application/pdf',
      amount: 30_000_000, date: '2026-08-20', supplier: 'Vivero Ciénaga Viva', concept: '20.000 plántulas de Rhizophora mangle',
      budget_line_id: 'R1', task_id: 3, task_title: 'Comprar plántulas',
      citizen_summary: 'Compra de 20.000 plántulas de mangle rojo para sembrar 5 hectáreas.', alerts: [],
      created_at: '2026-08-20T15:00:00Z',
    },
  ],
  alerts: [{
    id: 1, expense_id: 3, level: 'medium', source: 'ai', answer: null, answered_at: null,
    reason: 'El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.',
  }],
  public_url: '/p/demo',
})
