import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { ThemeProvider } from '../../app/theme'
import { MermaidView } from '../components/documents/MermaidView'
import { renderApp } from '../../test/renderApp'

vi.mock('mermaid', () => ({
  default: {
    initialize: () => {},
    parse: async (source: string) => {
      if (source.includes('roto')) throw new Error('Parse error on line 2')
      return true
    },
    render: async () => ({ svg: '<svg><text>diagrama</text></svg>' }),
  },
}))

const generalSpec = (backend: ReturnType<typeof createFakeBackend>) =>
  [...backend.store.documents.values()].find((d) => d.project_id === 2 && d.kind === 'general_spec')!

describe('Documents', () => {
  it('regenerates a spec with instructions; approving it adds a version and keeps the old ones', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 20 })
    renderApp('/projects/2/documents', backend)

    const viewer = await screen.findByRole('article')
    await user.click(within(viewer).getByRole('button', { name: 'Regenerar' }))
    const dialog = screen.getByRole('dialog', { name: 'Regenerar Spec general' })
    await user.click(within(dialog).getByRole('button', { name: 'Regenerar' }))
    expect(within(dialog).getByRole('textbox', { name: 'Instrucciones' })).toHaveAccessibleDescription('Escribe qué debería cambiar.')
    await user.type(within(dialog).getByRole('textbox', { name: 'Instrucciones' }), 'Agrega el caso sin conexión')
    await user.click(within(dialog).getByRole('button', { name: 'Regenerar' }))

    expect(await screen.findByText('Hay una versión nueva esperando tu aprobación', {}, { timeout: 3000 })).toBeInTheDocument()
    await user.click(within(screen.getByRole('article')).getByRole('button', { name: 'Aprobar' }))

    await waitFor(() => expect(generalSpec(backend).version).toBe(3))
    expect(Object.keys(generalSpec(backend).contents)).toEqual(['1', '2', '3'])
    expect(await screen.findByText('Agrega el caso sin conexión')).toBeInTheDocument()
  })

  it('keeps the text and offers to reload or copy when someone saved first', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 20 })
    renderApp('/projects/2/documents', backend)

    const viewer = await screen.findByRole('article')
    await user.click(within(viewer).getByRole('button', { name: 'Editar' }))
    const editor = within(viewer).getByRole('textbox', { name: 'Contenido' })
    await user.type(editor, ' Mi cambio')

    // Someone else saves version 3 meanwhile.
    await backend.gateways.documents.save(generalSpec(backend).id, 'Otra versión', 2)
    await user.click(within(viewer).getByRole('button', { name: 'Guardar versión nueva' }))

    expect(await within(viewer).findByText('Alguien guardó la versión 3 mientras editabas')).toBeInTheDocument()
    expect((editor as HTMLTextAreaElement).value).toContain('Mi cambio')
    expect(within(viewer).getByRole('button', { name: 'Copiar mi texto' })).toBeInTheDocument()
    expect(within(viewer).getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })
})

describe('MermaidView', () => {
  it('shows the source and says so when a diagram can not be drawn', async () => {
    render(<ThemeProvider><MermaidView source={'flowchart LR\n  roto -->'} title="Flujo" /></ThemeProvider>)
    expect(await screen.findByText(/No se pudo dibujar el diagrama/)).toBeInTheDocument()
    expect(screen.getByText(/roto -->/)).toBeInTheDocument()
  })

  it('draws a valid diagram', async () => {
    render(<ThemeProvider><MermaidView source="flowchart LR\n  A --> B" title="Flujo" /></ThemeProvider>)
    expect(await screen.findByRole('img', { name: 'Flujo' })).toHaveTextContent('diagrama')
  })
})
