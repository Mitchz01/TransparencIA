import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { samplePortal } from '../../adapters/fake/samplePortal'
import { ApiError } from '../../application/errors'
import { notFound, renderPortal as renderAt } from '../../test/renderPortal'

const portal = samplePortal()
const unavailable = () => Promise.reject(new ApiError(502, { code: 'agent_unavailable', detail: 'Agent failed.' }))

describe('PublicPortalPage', () => {
  it('shows the published project with its traffic light, budget lines and evidence', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: notFound })
    expect(await screen.findByRole('heading', { name: portal.project.name })).toBeVisible()
    expect(screen.getByText(/Fundación Manglares Vivos lo ejecuta para Corpamag/)).toBeVisible()
    expect(screen.getByText('En amarillo')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'En qué se reparte la plata' })).toBeVisible()
    expect(screen.getByText(portal.expenses[2].citizen_summary)).toBeVisible()
    expect(screen.getByText(/Ley 1712 de 2014/)).toBeVisible()
  })

  it('answers a suggested question in the chat', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: () => Promise.resolve({ answer: 'En plántulas de mangle.' }) })
    await userEvent.click(await screen.findByRole('button', { name: '¿En qué se gastaron la plata?' }))
    expect(await screen.findByText('En plántulas de mangle.')).toBeVisible()
  })

  it('says the assistant is down while the data stays', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: unavailable })
    await userEvent.click(await screen.findByRole('button', { name: '¿Cuánto falta por ejecutar?' }))
    expect(await screen.findByText(/El asistente no está disponible/)).toBeVisible()
    expect(screen.getByText('En amarillo')).toBeVisible()
  })

  it('says the project isn’t public when the link is unknown or unpublished', async () => {
    renderAt('/p/nope', { getPortal: notFound, ask: notFound })
    expect(await screen.findByText('Este proyecto no existe o no es público')).toBeVisible()
  })

  it('never asks to sign in: any other path is not a portal', async () => {
    renderAt('/otra/ruta', {})
    expect(await screen.findByText('Este proyecto no existe o no es público')).toBeVisible()
  })
})
