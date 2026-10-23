import type { Alert, Summary } from '@agile/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AlertList } from './AlertList'
import { BudgetLines } from './BudgetLines'
import { ProgressBars } from './ProgressBars'
import { TrafficLight } from './TrafficLight'
import { WeeklyTimeline } from './WeeklyTimeline'

const summary: Summary = {
  spent: 72_000_000, spent_pct: 40, physical_pct: 25, time_pct: 46.2, unallocated: 0, light: 'red',
  reasons: ['Se ha gastado 15 puntos más de lo que se ha avanzado'],
}

const alert: Alert = {
  id: 7, expense_id: 3, level: 'medium', source: 'ai', answer: null, answered_at: null,
  reason: 'El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.',
}

describe('TrafficLight', () => {
  it('names the state with a word and says why', () => {
    render(<TrafficLight summary={summary} />)
    expect(screen.getByText('En rojo')).toBeVisible()
    expect(screen.getByText('Se ha gastado 15 puntos más de lo que se ha avanzado')).toBeVisible()
  })
})

describe('ProgressBars', () => {
  it('shows the three percentages from the summary', () => {
    render(<ProgressBars summary={summary} />)
    expect(screen.getByRole('progressbar', { name: /Dinero usado: 40 %/ })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: /Trabajo hecho: 25 %/ })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: /Tiempo corrido: 46,2 %/ })).toBeVisible()
  })

  it('says there are no planned activities instead of 0 %', () => {
    render(<ProgressBars summary={{ ...summary, physical_pct: null }} />)
    expect(screen.getByText('Sin actividades planeadas')).toBeVisible()
  })

  it('says when spending goes over the contract', () => {
    render(<ProgressBars summary={{ ...summary, spent_pct: 112 }} />)
    expect(screen.getByText(/más que el valor del contrato/)).toBeVisible()
  })
})

describe('BudgetLines', () => {
  it('shows what is left, or by how much a line is overspent', () => {
    render(
      <BudgetLines
        lines={[
          { id: 'R1', name: 'Plántulas de mangle', amount: 45_000_000, spent: 30_000_000, available: 15_000_000 },
          { id: 'R3', name: 'Logística', amount: 2_000_000, spent: 3_000_000, available: -1_000_000 },
        ]}
      />,
    )
    expect(screen.getByText(/Quedan \$\s?15\.000\.000/)).toBeVisible()
    expect(screen.getByText(/Excedido en \$\s?1\.000\.000/)).toBeVisible()
  })
})

describe('WeeklyTimeline', () => {
  it('lists the weeks newest first with what was done and spent', () => {
    render(
      <WeeklyTimeline
        timeline={[
          { week_start: '2026-08-03', tasks_done: [{ id: 1, title: 'Diagnóstico del sitio' }], spent: 0, spent_pct_acc: 0, physical_pct_acc: 5 },
          { week_start: '2026-08-10', tasks_done: [], spent: 30_000_000, spent_pct_acc: 16.7, physical_pct_acc: 5 },
        ]}
      />,
    )
    const weeks = screen.getAllByText(/^Semana del/)
    expect(weeks[0]).toHaveTextContent('10')
    expect(screen.getByText('Diagnóstico del sitio')).toBeVisible()
    expect(screen.getByRole('img', { name: /dinero usado 16,7 %/ })).toBeInTheDocument()
  })
})

describe('AlertList', () => {
  it('flags for review, never accuses, and tells AI alerts from rule alerts', () => {
    render(<AlertList alerts={[alert, { ...alert, id: 8, source: 'rule', level: 'high' }]} />)
    expect(screen.getAllByText('En revisión')).toHaveLength(2)
    expect(screen.getByText('Detectada por IA')).toBeVisible()
    expect(screen.getByText('Regla automática')).toBeVisible()
    expect(screen.queryByText(/fraude|irregularidad/i)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull()
  })

  it('lets the executing entity answer when onAnswer is given', async () => {
    const onAnswer = vi.fn()
    render(<AlertList alerts={[alert]} onAnswer={onAnswer} />)
    await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
    await userEvent.type(screen.getByLabelText('Respuesta pública'), 'Se reclasificó a logística')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))
    expect(onAnswer).toHaveBeenCalledWith(7, 'Se reclasificó a logística')
  })

  it('shows the answer under the alert, which stays visible', () => {
    render(<AlertList alerts={[{ ...alert, answer: 'Se reclasificó a logística' }]} />)
    expect(screen.getByText('Respuesta del ejecutor')).toBeVisible()
    expect(screen.getByText(alert.reason)).toBeVisible()
  })
})
