import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

// Spec 017 on the fake backend: project 2 starts with the demo portal (budget, 3 expenses, 1 draft),
// project 1 has no budget yet. Ana is the leader of both, Leo a member.
const backend = (as?: string) => {
  const store = new FakeStore()
  if (as) store.signInAs(as)
  return createFakeBackend({ store, stageDelayMs: 20 })
}

describe('Transparencia (spec 017)', () => {
  it('a leader sets the budget of a project that has none, with "sin asignar" for the rest', async () => {
    const user = userEvent.setup()
    renderApp('/projects/1/transparency', backend())

    const form = await screen.findByRole('form', { name: 'Presupuesto' })
    await user.type(within(form).getByRole('textbox', { name: 'Entidad contratante' }), 'Corpamag')
    await user.type(within(form).getByRole('textbox', { name: 'Contratista (ejecutor)' }), 'Fundación Manglares Vivos')
    await user.type(within(form).getByRole('textbox', { name: 'Valor del contrato' }), '180000000')
    await user.type(within(form).getByLabelText('Fecha de inicio'), '2026-08-03')
    await user.type(within(form).getByRole('textbox', { name: 'Nombre del rubro R1' }), 'Plántulas de mangle')
    await user.type(within(form).getByRole('textbox', { name: 'Monto del rubro R1' }), '45000000')

    expect(within(form).getByText('Sin asignar $135.000.000')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Guardar presupuesto' }))

    expect(await screen.findByRole('heading', { name: 'Registrar gasto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Portal público' })).toBeInTheDocument()
  }, 20000)

  it('a member sees that the leader has to set the budget', async () => {
    renderApp('/projects/1/transparency', backend('Leo'))
    expect(await screen.findByText('El proyecto aún no tiene presupuesto')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Presupuesto' })).not.toBeInTheDocument()
  }, 20000)

  it('confirms the draft the AI read; it leaves the drafts and counts in the portal', async () => {
    const user = userEvent.setup()
    const app = backend()
    renderApp('/projects/2/transparency', app)

    const draft = await screen.findByRole('form', { name: 'Borrador Transportes La Ciénaga' })
    expect(within(draft).getByRole('combobox', { name: 'Rubro' })).toHaveValue('R3')
    await user.click(within(draft).getByRole('button', { name: 'Confirmar y publicar' }))

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Borrador Transportes La Ciénaga' })).not.toBeInTheDocument())
    const portal = await app.gateways.transparency.getTeamPortal(2)
    expect(portal.drafts).toHaveLength(0)
    expect(portal.expenses[0].supplier).toBe('Transportes La Ciénaga')
    expect(portal.summary.spent).toBe(32400000 + 1850000)
  }, 20000)

  it('rejects a file that is not a PDF or an image before calling the AI', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderApp('/projects/2/transparency', backend())

    const input = await screen.findByLabelText('Subir evidencia')
    await user.upload(input, new File(['hola'], 'notas.txt', { type: 'text/plain' }))
    expect(await screen.findByText(/Ese archivo no sirve/)).toBeInTheDocument()
  }, 20000)

  it('shows the published link of the portal app with its QR', async () => {
    renderApp('/projects/2/transparency', backend())
    expect(await screen.findByText('http://localhost:5174/p/manglar-cienaga')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Publicado' })).toBeChecked()
  }, 20000)
})
