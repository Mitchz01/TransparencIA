import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { DEMO_PASSWORD } from '../../adapters/fake/demoData'
import { renderApp } from '../../test/renderApp'

/** A fake backend nobody is signed in to. */
function signedOut(seed = true) {
  const backend = createFakeBackend({ store: new FakeStore(seed), stageDelayMs: 10 })
  backend.store.session = null
  return backend
}

describe('Sign in (spec 015, US1)', () => {
  it('says the same thing for a wrong password and an unknown email, without marking a field', async () => {
    const user = userEvent.setup()
    renderApp('/login', signedOut())

    const email = await screen.findByRole('textbox', { name: 'Email' })
    const password = screen.getByLabelText('Contraseña')
    await user.type(email, 'ana@team.dev')
    await user.type(password, 'not-the-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')

    await user.clear(email)
    await user.type(email, 'nobody@team.dev')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
    expect(email).not.toHaveAttribute('aria-invalid')
    expect(password).not.toHaveAttribute('aria-invalid')
  })

  it('only says "Próximamente" for Google and SSO', async () => {
    const user = userEvent.setup()
    const backend = signedOut()
    const { router } = renderApp('/login', backend)

    for (const provider of ['Google', 'SSO']) {
      await user.click(await screen.findByRole('button', { name: `Continuar con ${provider}` }))
      expect(await screen.findByText('Próximamente')).toBeInTheDocument()
    }
    expect(router.state.location.pathname).toBe('/login')
    expect(backend.store.session).toBeNull()
  })

  it('sends someone without a session to sign in, and back to where they were going', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/projects/2/board', signedOut())

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/projects/2/board')}`)
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'ANA@team.dev')
    await user.type(screen.getByLabelText('Contraseña'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/2/board'))
  })

  it('goes to sign in with `next` when any call answers 401 (the session ended)', async () => {
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/', backend)
    await within(await screen.findByRole('region', { name: 'Tus proyectos' })).findByRole('link', { name: /Tienda online/ })

    backend.store.session = null // the session expires while the list is open
    await router.navigate('/projects/2/board')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/projects/2/board')}`)
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

describe('Sign up and profile (spec 015, US1 and US2)', () => {
  it('leads to the profile step, which saves what you do and goes home', async () => {
    const user = userEvent.setup()
    const backend = signedOut(false)
    const { router } = renderApp('/signup', backend)

    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Carla Pérez')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'carla@team.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'short')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Usa al menos 8 caracteres.')

    await user.type(screen.getByLabelText('Contraseña'), '-but-long-now')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'))
    expect(await screen.findByRole('heading', { name: 'Cuéntanos qué haces' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Backend' }))
    await user.click(screen.getByRole('radio', { name: 'Senior' }))
    const hours = screen.getByRole('textbox', { name: 'Horas por semana' })
    expect(hours).toHaveValue('20')
    await user.clear(hours)
    await user.type(hours, '30')
    await user.click(screen.getByRole('button', { name: 'Guardar y seguir' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    const account = [...backend.store.accounts.values()].find((a) => a.email === 'carla@team.dev')!
    expect(account).toMatchObject({ name: 'Carla Pérez', role: 'Backend', seniority: 'senior', hours_per_week: 30 })
    expect(await screen.findByText('Todavía no hay proyectos')).toBeInTheDocument()
  })

  it('says an email is taken under the field, with a way to sign in', async () => {
    const user = userEvent.setup()
    renderApp('/signup', signedOut())

    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Ana')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), ' ANA@team.dev')
    await user.type(screen.getByLabelText('Contraseña'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Ese email ya tiene cuenta.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ANA@team.dev')
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' }).length).toBeGreaterThan(0)
  })

  it('signs out from the account menu', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/', backend)

    await user.click(await screen.findByRole('button', { name: 'Cuenta: Ana Gómez' }))
    expect(screen.getByText('ana@team.dev')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(backend.store.session).toBeNull()
  })
})

describe('My profile (spec 015, US2)', () => {
  it('shows how the team sees you, following the form as you type, and saves', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/profile', backend)

    const card = await screen.findByRole('article', { name: 'Así te ve tu equipo' })
    expect(card.querySelector('img')).toHaveAttribute('src', '/avatars/ana-gomez.jpg')
    expect(within(card).getByRole('heading', { name: 'Ana Gómez' })).toBeInTheDocument()
    expect(within(card).getByText('Backend')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fullstack' }))
    const hours = screen.getByRole('textbox', { name: 'Horas por semana' })
    await user.clear(hours)
    expect(within(card).getByText('30 h por semana')).toBeInTheDocument() // half-written: keeps the saved value
    await user.type(hours, '25')
    expect(within(card).getByText('Fullstack')).toBeInTheDocument()
    expect(within(card).getByText('25 h por semana')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(backend.store.accounts.get(1)).toMatchObject({ role: 'Fullstack', hours_per_week: 25, avatar_url: '/avatars/ana-gomez.jpg' })
  })

  it('gives the demo people their photos in a demo saved before photos existed', () => {
    const storage = new Map<string, string>()
    const fakeStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) } as Storage
    const old = new FakeStore()
    for (const account of old.accounts.values()) delete (account as Partial<typeof account>).avatar_url
    for (const project of old.projects.values()) project.members.forEach((m) => delete m.avatar_url)
    old.accounts.get(2)!.avatar_url = null // Leo removed his on purpose: it stays removed
    old.save(fakeStorage)

    const restored = new FakeStore(false)
    expect(restored.restore(fakeStorage)).toBe(true)
    expect(restored.accounts.get(1)!.avatar_url).toBe('/avatars/ana-gomez.jpg')
    expect(restored.accounts.get(2)!.avatar_url).toBeNull()
    const members = [...restored.projects.values()].flatMap((p) => p.members)
    expect(members.find((m) => m.name === 'Marta Díaz')!.avatar_url).toBe('/avatars/marta-diaz.jpg')
    expect(members.filter((m) => m.account_id === 1).every((m) => m.avatar_url === '/avatars/ana-gomez.jpg')).toBe(true)
  })
})
