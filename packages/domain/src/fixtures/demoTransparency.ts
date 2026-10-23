// Spec 017's demo project as a TeamPortal, with the numbers of specs/017-transparency-portal/team/README.md.
// Owner: P4. Exported as @agile/domain/fixtures; both apps' fake gateways read it.
//
// The numbers are the ones the backend's rules give for this data on 2026-10-23 (week 12 of 26):
// 32.4M spent of 180M (18.0%), 18 of 60 points done (30.0%), 81 of 181 days (44.8%), and one medium
// alert, so the light is yellow. Change the data and the numbers together.

import type { Alert, Budget, Expense, TeamPortal } from '../transparency'

export const DEMO_TODAY = '2026-10-23'
export const DEMO_SLUG = 'manglar-cienaga'

export const demoBudget = (): Budget => ({
  contracting_entity: 'Corpamag',
  contractor: 'Fundación Manglares Vivos',
  contract_value: 180000000,
  start_date: '2026-08-03',
  end_date: '2027-01-31', // inclusive: start + 26 weeks - 1 day, like the backend's end_date
  lines: [
    { id: 'R1', name: 'Plántulas de mangle', amount: 45000000 },
    { id: 'R2', name: 'Mano de obra local', amount: 70000000 },
    { id: 'R3', name: 'Logística y transporte fluvial', amount: 30000000 },
    { id: 'R4', name: 'Monitoreo y talleres comunitarios', amount: 35000000 },
  ],
})

/** The board's tasks the expenses and the timeline point at (ids as the seed would give them). */
export const DEMO_TASKS = {
  diagnosis: { id: 101, title: 'Diagnóstico del sitio' },
  community: { id: 102, title: 'Socializar el proyecto con la comunidad' },
  seedlings: { id: 103, title: 'Comprar plántulas' },
  nursery: { id: 104, title: 'Adecuar el vivero' },
  plantLot1: { id: 105, title: 'Sembrar lote 1 (1 ha)' },
  workshop: { id: 106, title: 'Taller de cuidado del manglar' },
  monitoring: { id: 107, title: 'Primer monitoreo de supervivencia' },
  transport: { id: 108, title: 'Transporte fluvial de plántulas' },
} as const

const restaurantAlert: Alert = {
  id: 1,
  level: 'medium',
  reason: 'El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.',
  source: 'ai',
  answer: null,
  answered_at: null,
}

const confirmed = (): Expense[] => [
  // Newest first, as the API returns them.
  {
    id: 3,
    kind: 'invoice',
    status: 'confirmed',
    file_url: '/api/files/3',
    mime: 'image/jpeg',
    amount: 2400000,
    date: '2026-10-02',
    supplier: 'Restaurante El Muelle',
    concept: 'Almuerzos para la jornada de siembra',
    budget_line_id: 'R1',
    task_id: null,
    task_title: null,
    citizen_summary: 'Almuerzos para el equipo de campo, cargados al rubro de plántulas.',
    alerts: [restaurantAlert],
    created_at: '2026-10-03T15:20:00Z',
  },
  {
    id: 2,
    kind: 'field_photo',
    status: 'confirmed',
    file_url: '/api/files/2',
    mime: 'image/jpeg',
    amount: null,
    date: '2026-09-15',
    supplier: null,
    concept: 'Siembra de la primera hectárea',
    budget_line_id: 'R2',
    task_id: DEMO_TASKS.plantLot1.id,
    task_title: DEMO_TASKS.plantLot1.title,
    citizen_summary: 'La comunidad sembró la primera hectárea de mangle rojo.',
    alerts: [],
    created_at: '2026-09-15T22:05:00Z',
  },
  {
    id: 1,
    kind: 'invoice',
    status: 'confirmed',
    file_url: '/api/files/1',
    mime: 'application/pdf',
    amount: 30000000,
    date: '2026-08-20',
    supplier: 'Vivero Ciénaga Viva',
    concept: '20.000 plántulas de Rhizophora mangle',
    budget_line_id: 'R1',
    task_id: DEMO_TASKS.seedlings.id,
    task_title: DEMO_TASKS.seedlings.title,
    citizen_summary: 'Se compraron 20.000 plántulas de mangle rojo para sembrar 5 hectáreas.',
    alerts: [],
    created_at: '2026-08-21T14:00:00Z',
  },
]

const draft = (): Expense => ({
  id: 4,
  kind: 'invoice',
  status: 'draft',
  file_url: '/api/files/4',
  mime: 'application/pdf',
  amount: 1850000,
  date: '2026-10-20',
  supplier: 'Transportes La Ciénaga',
  concept: 'Alquiler de lancha para llevar plántulas al lote 2',
  budget_line_id: 'R3',
  task_id: DEMO_TASKS.transport.id,
  task_title: DEMO_TASKS.transport.title,
  citizen_summary: 'Transporte en lancha de las plántulas hasta el lote 2.',
  alerts: [],
  created_at: '2026-10-21T13:10:00Z',
})

const week = (week_start: string, tasks: { id: number; title: string }[], spent: number, spent_pct_acc: number, physical_pct_acc: number) => ({
  week_start,
  tasks_done: tasks.map(({ id, title }) => ({ id, title })),
  spent,
  spent_pct_acc,
  physical_pct_acc,
})

/** A fresh copy every call, so a fake can change it freely. */
export const demoTeamPortal = (): TeamPortal => {
  const budget = demoBudget()
  const expenses = confirmed()
  return {
    project: {
      name: 'Restauración de manglar en la Ciénaga Grande',
      description:
        'Restauración de 5 ha de manglar en la Ciénaga Grande de Santa Marta: vivero, siembra, mantenimiento, monitoreo y talleres con la comunidad. Contrato con Corpamag por $180.000.000, 6 meses.',
      contracting_entity: budget.contracting_entity,
      contractor: budget.contractor,
      contract_value: budget.contract_value,
      start_date: budget.start_date,
      end_date: budget.end_date,
    },
    summary: {
      spent: 32400000,
      spent_pct: 18.0,
      physical_pct: 30.0,
      time_pct: 44.8,
      unallocated: 0,
      light: 'yellow',
      reasons: ['Hay 1 alerta de nivel medio en revisión'],
    },
    lines: [
      { id: 'R1', name: 'Plántulas de mangle', amount: 45000000, spent: 32400000, available: 12600000 },
      { id: 'R2', name: 'Mano de obra local', amount: 70000000, spent: 0, available: 70000000 },
      { id: 'R3', name: 'Logística y transporte fluvial', amount: 30000000, spent: 0, available: 30000000 },
      { id: 'R4', name: 'Monitoreo y talleres comunitarios', amount: 35000000, spent: 0, available: 35000000 },
    ],
    timeline: [
      week('2026-08-03', [DEMO_TASKS.diagnosis], 0, 0, 5.0),
      week('2026-08-10', [DEMO_TASKS.community], 0, 0, 8.3),
      week('2026-08-17', [DEMO_TASKS.seedlings], 30000000, 16.7, 13.3),
      week('2026-08-24', [], 0, 16.7, 13.3),
      week('2026-08-31', [DEMO_TASKS.nursery], 0, 16.7, 16.7),
      week('2026-09-07', [], 0, 16.7, 16.7),
      week('2026-09-14', [DEMO_TASKS.plantLot1], 0, 16.7, 21.7),
      week('2026-09-21', [DEMO_TASKS.workshop], 0, 16.7, 25.0),
      week('2026-09-28', [], 2400000, 18.0, 25.0),
      week('2026-10-05', [DEMO_TASKS.monitoring], 0, 18.0, 30.0),
      week('2026-10-12', [], 0, 18.0, 30.0),
      week('2026-10-19', [], 0, 18.0, 30.0),
    ],
    sprints: [
      { name: 'Diagnóstico', goal: 'Conocer el sitio y a la comunidad', end_date: '2026-08-31', done_points: 8, total_points: 8, tasks: [] },
      { name: 'Vivero', goal: 'Tener el vivero listo con las plántulas', end_date: '2026-09-28', done_points: 4, total_points: 8, tasks: [] },
      { name: 'Siembra lotes 1–2', goal: 'Sembrar las dos primeras hectáreas', end_date: '2026-10-26', done_points: 6, total_points: 12, tasks: [] },
      { name: 'Siembra lotes 3–5', goal: 'Sembrar las tres hectáreas restantes', end_date: '2026-11-23', done_points: 0, total_points: 12, tasks: [] },
      { name: 'Mantenimiento', goal: 'Resembrar y cuidar lo sembrado', end_date: '2026-12-28', done_points: 0, total_points: 10, tasks: [] },
      { name: 'Monitoreo y cierre', goal: 'Medir la supervivencia y entregar', end_date: '2027-01-31', done_points: 0, total_points: 10, tasks: [] },
    ],
    expenses,
    alerts: [{ ...restaurantAlert, expense_id: 3 }],
    public_url: `/p/${DEMO_SLUG}`,
    drafts: [draft()],
    public: true,
  }
}
