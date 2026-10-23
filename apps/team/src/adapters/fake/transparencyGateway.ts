// Spec 017 without a backend: in memory over @agile/domain/fixtures. Owner: P4.
// It answers like the API Contract of specs/017-transparency-portal/plan.md: same shapes, same error
// codes, the same guards (view to read, work to upload and confirm, manage for budget, publication
// and answers). It doesn't run the rules: it only keeps spent and the lines in step with the expenses.

import {
  TRANSPARENCY_LIMITS, type Alert, type AlertLevel, type Budget, type BudgetInput, type Expense, type TeamPortal,
} from '@agile/domain'
import { DEMO_SLUG, demoTeamPortal } from '@agile/domain/fixtures'
import type { TransparencyGateway } from '../../application/ports'
import type { FieldError } from '../../application/errors'
import { authorize, type Action } from './access'
import { type FakeStore, fail, invalid, online, reply } from './store'

/** The project the demo portal belongs to: the fake's planned project (demoBoardProject). */
const DEMO_PROJECT_ID = 2
const READ_DELAY_MS = 1500

interface ProjectState {
  budget: Budget | null
  portal: TeamPortal | null
  slug: string | null
}

/** An alert as the agent writes it, before it gets an id and a source. */
interface AlertDraftLike {
  level: AlertLevel
  reason: string
}

/** The contract's last day, inclusive, like the backend's `end_date` (start + weeks - 1 day). */
const endDateFor = (start: string, weeks: number) => {
  const date = new Date(`${start}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7 - 1)
  return date.toISOString().slice(0, 10)
}

const states = new WeakMap<FakeStore, Map<number, ProjectState>>()

function stateOf(store: FakeStore, projectId: number): ProjectState {
  let byProject = states.get(store)
  if (!byProject) {
    byProject = new Map()
    states.set(store, byProject)
  }
  let state = byProject.get(projectId)
  if (!state) {
    if (projectId === DEMO_PROJECT_ID) {
      const portal = demoTeamPortal()
      const { project } = portal
      // The fixture's tasks are the seed's mangrove board; the fake's board has other ids. A draft
      // pointing at a task this board lacks would fail to confirm, as it would in the API.
      const taskIds = new Set((store.boards.get(projectId)?.tasks ?? []).map((t) => t.id))
      for (const draft of portal.drafts) {
        if (draft.task_id !== null && !taskIds.has(draft.task_id)) Object.assign(draft, { task_id: null, task_title: null })
      }
      state = {
        budget: {
          contracting_entity: project.contracting_entity,
          contractor: project.contractor,
          contract_value: project.contract_value,
          start_date: project.start_date,
          end_date: project.end_date,
          lines: portal.lines.map(({ id, name, amount }) => ({ id, name, amount })),
        },
        portal,
        slug: DEMO_SLUG,
      }
    } else {
      state = { budget: null, portal: null, slug: null }
    }
    byProject.set(projectId, state)
  }
  return state
}


const budgetMissing = (): never => fail(409, { code: 'budget_missing', detail: 'El proyecto aún no tiene presupuesto.' })
const expenseNotFound = (id: number): never => fail(404, { code: 'expense_not_found', detail: `No existe (expense ${id}).` })
const notDraft = (): never => fail(409, { code: 'expense_not_draft', detail: 'Ese gasto ya está confirmado.' })

function budgetErrors(body: BudgetInput): FieldError[] {
  const errors: FieldError[] = []
  if (!body.contracting_entity.trim()) errors.push({ field: 'contracting_entity', message: 'Escribe la entidad contratante.' })
  if (!body.contractor.trim()) errors.push({ field: 'contractor', message: 'Escribe el contratista.' })
  if (!(body.contract_value > 0)) errors.push({ field: 'contract_value', message: 'Debe ser mayor que 0.' })
  if (!body.start_date) errors.push({ field: 'start_date', message: 'Elige la fecha de inicio.' })
  const seen = new Set<string>()
  body.lines.forEach((line, i) => {
    const name = line.name.trim()
    if (!name || name.length > TRANSPARENCY_LIMITS.lineName) errors.push({ field: `lines[${i}].name`, message: `Entre 1 y ${TRANSPARENCY_LIMITS.lineName} caracteres.` })
    if (!(line.amount >= 0)) errors.push({ field: `lines[${i}].amount`, message: 'No puede ser negativo.' })
    if (seen.has(line.id)) errors.push({ field: `lines[${i}].id`, message: 'Rubro repetido.' })
    seen.add(line.id)
  })
  return errors
}

/** A portal for a project that had no data yet: no spending, no timeline (the rules live in the backend). */
function emptyPortal(name: string, description: string, budget: Budget): TeamPortal {
  const assigned = budget.lines.reduce((sum, l) => sum + l.amount, 0)
  return {
    project: {
      name, description,
      contracting_entity: budget.contracting_entity, contractor: budget.contractor,
      contract_value: budget.contract_value, start_date: budget.start_date, end_date: budget.end_date,
    },
    summary: {
      spent: 0, spent_pct: 0, physical_pct: null, time_pct: 0, unallocated: budget.contract_value - assigned,
      light: 'green', reasons: ['El gasto va acorde con el avance de las actividades'],
    },
    lines: budget.lines.map((l) => ({ ...l, spent: 0, available: l.amount })),
    timeline: [],
    sprints: [],
    expenses: [],
    alerts: [],
    public_url: null,
    drafts: [],
    public: false,
  }
}

/** Keeps the portal's header, lines and spent in step with the budget and the confirmed expenses. */
function refresh(portal: TeamPortal, budget: Budget): void {
  const spentBy = new Map<string, number>()
  for (const e of portal.expenses) {
    if (e.budget_line_id && e.amount) spentBy.set(e.budget_line_id, (spentBy.get(e.budget_line_id) ?? 0) + e.amount)
  }
  const spent = portal.expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const assigned = budget.lines.reduce((sum, l) => sum + l.amount, 0)
  portal.project = {
    ...portal.project,
    contracting_entity: budget.contracting_entity, contractor: budget.contractor,
    contract_value: budget.contract_value, start_date: budget.start_date, end_date: budget.end_date,
  }
  portal.lines = budget.lines.map((l) => {
    const lineSpent = spentBy.get(l.id) ?? 0
    return { ...l, spent: lineSpent, available: l.amount - lineSpent }
  })
  portal.summary = {
    ...portal.summary,
    spent,
    spent_pct: Math.round((spent / budget.contract_value) * 1000) / 10,
    unallocated: budget.contract_value - assigned,
  }
  portal.alerts = portal.expenses.flatMap((e) => e.alerts.map((a) => ({ ...a, expense_id: e.id })))
}

/** What the mock evidence agent answers, by filename like P2's (restaurante, foto, else the seedlings invoice). */
function reading(filename: string, taskId: (needle: string) => number | null): Omit<Expense, 'id' | 'file_url' | 'mime' | 'created_at' | 'status' | 'alerts'> & { alerts: AlertDraftLike[] } {
  const name = filename.toLowerCase()
  if (name.includes('restaurante')) {
    return {
      kind: 'invoice', amount: 2400000, date: '2026-10-02', supplier: 'Restaurante El Muelle',
      concept: 'Almuerzos para la jornada de siembra', budget_line_id: 'R1', task_id: null, task_title: null,
      citizen_summary: 'Almuerzos para el equipo de campo.',
      alerts: [{ level: 'medium', reason: 'El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.' }],
    }
  }
  if (name.includes('foto')) {
    return {
      kind: 'field_photo', amount: null, date: '2026-10-22', supplier: null, concept: 'Siembra en el lote 2',
      budget_line_id: 'R2', task_id: taskId('sembrar'), task_title: null,
      citizen_summary: 'Siembra de mangle rojo en el lote 2.', alerts: [],
    }
  }
  return {
    kind: 'invoice', amount: 30000000, date: '2026-08-20', supplier: 'Vivero Ciénaga Viva',
    concept: '20.000 plántulas de Rhizophora mangle', budget_line_id: 'R1', task_id: taskId('plántulas'), task_title: null,
    citizen_summary: 'Se compraron 20.000 plántulas de mangle rojo.', alerts: [],
  }
}

const previewUrl = (file: File, id: number) => {
  try {
    return URL.createObjectURL(file)
  } catch {
    return `/api/files/${id}` // jsdom has no object URLs
  }
}

export function fakeTransparencyGateway(store: FakeStore): TransparencyGateway {
  const allow = (projectId: number, action: Action) => authorize(store, projectId, action)
  const withBudget = (projectId: number) => {
    const state = stateOf(store, projectId)
    if (!state.budget || !state.portal) return budgetMissing()
    return state as ProjectState & { budget: Budget; portal: TeamPortal }
  }
  const findDraft = (portal: TeamPortal, expenseId: number) => {
    const draft = portal.drafts.find((d) => d.id === expenseId)
    if (draft) return draft
    return portal.expenses.some((e) => e.id === expenseId) ? notDraft() : expenseNotFound(expenseId)
  }
  const tasksOf = (projectId: number) => store.boards.get(projectId)?.tasks ?? []

  return {
    async getBudget(projectId) {
      allow(projectId, 'view')
      return reply(stateOf(store, projectId).budget)
    },

    async setBudget(projectId, body) {
      await online()
      allow(projectId, 'manage')
      const errors = budgetErrors(body)
      if (errors.length) invalid(errors)
      const project = store.projects.get(projectId)!
      const budget: Budget = { ...body, end_date: endDateFor(body.start_date, project.duration_weeks) }
      const state = stateOf(store, projectId)
      state.budget = budget
      state.portal ??= emptyPortal(project.name, project.description, budget)
      refresh(state.portal, budget)
      return reply(budget)
    },

    async uploadEvidence(projectId, file) {
      await online()
      allow(projectId, 'work')
      const { portal } = withBudget(projectId)
      if (!(TRANSPARENCY_LIMITS.uploadTypes as readonly string[]).includes(file.type) || file.size > TRANSPARENCY_LIMITS.uploadBytes) {
        fail(422, { code: 'unsupported_file', detail: 'Sube un PDF o una imagen (JPG, PNG o WebP) de hasta 10 MB.' })
      }
      await new Promise((resolve) => setTimeout(resolve, READ_DELAY_MS))
      const tasks = tasksOf(projectId)
      const taskId = (needle: string) => tasks.find((t) => t.title.toLowerCase().includes(needle))?.id ?? null
      const read = reading(file.name, taskId)
      const id = store.id()
      const draft: Expense = {
        ...read,
        id,
        status: 'draft',
        file_url: previewUrl(file, id),
        mime: file.type,
        task_title: tasks.find((t) => t.id === read.task_id)?.title ?? null,
        alerts: read.alerts.map((a) => ({ ...a, id: store.id(), source: 'ai', answer: null, answered_at: null })),
        created_at: store.now(),
      }
      portal.drafts.unshift(draft)
      return reply(draft)
    },

    async confirmExpense(projectId, expenseId, body) {
      await online()
      allow(projectId, 'work')
      const { portal, budget } = withBudget(projectId)
      const draft = findDraft(portal, expenseId)
      const tasks = tasksOf(projectId)
      const errors: FieldError[] = []
      if (body.amount !== null && !(body.amount >= 0)) errors.push({ field: 'amount', message: 'No puede ser negativo.' })
      if (body.budget_line_id !== null && !budget.lines.some((l) => l.id === body.budget_line_id)) errors.push({ field: 'budget_line_id', message: 'Ese rubro no existe.' })
      if (body.task_id !== null && !tasks.some((t) => t.id === body.task_id)) errors.push({ field: 'task_id', message: 'Esa tarea no existe.' })
      const summary = body.citizen_summary.trim()
      if (!summary || summary.length > TRANSPARENCY_LIMITS.citizenSummary) {
        errors.push({ field: 'citizen_summary', message: `Entre 1 y ${TRANSPARENCY_LIMITS.citizenSummary} caracteres.` })
      }
      if (errors.length) invalid(errors)

      // The two rule alerts of FR-005, so the screen can show them apart from the AI's.
      const ruleAlerts: Alert[] = []
      const line = portal.lines.find((l) => l.id === body.budget_line_id)
      if (line && body.amount !== null && body.amount > line.available) {
        ruleAlerts.push({ id: store.id(), level: 'high', reason: `El gasto supera lo disponible en el rubro ${line.name}`, source: 'rule', answer: null, answered_at: null })
      }
      if (body.date && (body.date < budget.start_date || body.date > budget.end_date)) {
        ruleAlerts.push({ id: store.id(), level: 'medium', reason: `La fecha del gasto (${body.date}) está fuera del periodo del contrato`, source: 'rule', answer: null, answered_at: null })
      }
      const expense: Expense = {
        ...draft,
        ...body,
        citizen_summary: summary,
        status: 'confirmed',
        task_title: tasks.find((t) => t.id === body.task_id)?.title ?? null,
        alerts: [...draft.alerts, ...ruleAlerts],
      }
      portal.drafts = portal.drafts.filter((d) => d.id !== expenseId)
      portal.expenses.unshift(expense)
      refresh(portal, budget)
      return reply(expense)
    },

    async discardExpense(projectId, expenseId) {
      await online()
      allow(projectId, 'work')
      const { portal } = withBudget(projectId)
      findDraft(portal, expenseId)
      portal.drafts = portal.drafts.filter((d) => d.id !== expenseId)
      return reply(undefined)
    },

    async getTeamPortal(projectId) {
      allow(projectId, 'view')
      return reply(withBudget(projectId).portal)
    },

    async setPublication(projectId, isPublic) {
      await online()
      allow(projectId, 'manage')
      const state = withBudget(projectId)
      state.slug ??= store.token().slice(0, 11)
      state.portal.public = isPublic
      state.portal.public_url = `/p/${state.slug}`
      return reply({ public: isPublic, public_url: state.portal.public_url })
    },

    async answerAlert(projectId, alertId, answer) {
      await online()
      allow(projectId, 'manage')
      const { portal } = withBudget(projectId)
      const text = answer.trim()
      if (!text || text.length > TRANSPARENCY_LIMITS.answer) invalid([{ field: 'answer', message: `Entre 1 y ${TRANSPARENCY_LIMITS.answer} caracteres.` }])
      const alert = portal.expenses.flatMap((e) => e.alerts).find((a) => a.id === alertId)
      if (!alert) return fail(404, { code: 'alert_not_found', detail: `No existe (alert ${alertId}).` })
      alert.answer = text
      alert.answered_at = store.now()
      portal.alerts = portal.expenses.flatMap((e) => e.alerts.map((a) => ({ ...a, expense_id: e.id })))
      return reply(alert)
    },
  }
}
