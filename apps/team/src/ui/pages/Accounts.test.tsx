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
    await user.type(email, 'ana@manglaresvivos.org')
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

  it('only says "Próximamente" for Google and SSO, and never offers GitHub', async () => {
    const user = userEvent.setup()
    const backend = signedOut()
    const { router } = renderApp('/login', backend)

    expect(screen.queryByRole('button', { name: 'Continuar con GitHub' })).not.toBeInTheDocument()
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
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'ANA@manglaresvivos.org')
    await user.type(screen.getByLabelText('Contraseña'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/2/board'))
  })

  it('goes to sign in with `next` when any call answers 401 (the session ended)', async () => {
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/', backend)
    await within(await screen.findByRole('region', { name: 'Tus proyectos' })).findByRole('link', { name: /Piloto de restauración de manglar/ })

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
    // Spec 020: who registers projects, a natural person here, with what Colombian rules ask.
    expect(await screen.findByRole('heading', { name: 'Tus datos como ejecutor' })).toBeInTheDocument()
    expect(screen.queryByText(/Backend|Seniority|GitHub|Habilidades/)).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Número de documento' }), '1.020.304.050')
    await user.type(screen.getByRole('textbox', { name: 'Celular' }), '300 111 2233')
    await user.type(screen.getByRole('textbox', { name: 'Dirección' }), 'Calle 10 # 5-20')
    await user.type(screen.getByRole('textbox', { name: 'Municipio' }), 'Santa Marta')
    await user.type(screen.getByRole('textbox', { name: 'Departamento' }), 'Magdalena')
    await user.click(screen.getByRole('button', { name: 'Guardar y seguir' }))
    expect(await screen.findByText('Necesitamos tu autorización para tratar estos datos.')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Ley 1581 de 2012/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar y seguir' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    const account = [...backend.store.accounts.values()].find((a) => a.email === 'carla@team.dev')!
    expect(account).toMatchObject({
      name: 'Carla Pérez', person_type: 'natural', document_type: 'CC', document_number: '1020304050', phone: '3001112233', municipality: 'Santa Marta',
    })
    expect(account.data_consent_at).not.toBeNull()
    expect(await screen.findByText('Todavía no tienes proyectos')).toBeInTheDocument()
  })

  it('says an email is taken under the field, with a way to sign in', async () => {
    const user = userEvent.setup()
    renderApp('/signup', signedOut())

    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Ana')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), ' ANA@manglaresvivos.org')
    await user.type(screen.getByLabelText('Contraseña'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Ese email ya tiene cuenta.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ANA@manglaresvivos.org')
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' }).length).toBeGreaterThan(0)
  })

  it('signs out from the account menu', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/', backend)

    await user.click(await screen.findByRole('button', { name: 'Cuenta: Fundación Manglares Vivos' }))
    expect(screen.getByText('ana@manglaresvivos.org')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(backend.store.session).toBeNull()
  })
})

describe('My profile (spec 015, US2)', () => {
  it('shows how entities see you, following the form as you type, and checks the NIT (spec 020)', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/profile', backend)

    const card = await screen.findByRole('article', { name: 'Así te ven las entidades' })
    expect(card.querySelector('img')).toHaveAttribute('src', '/avatars/ana-gomez.jpg')
    expect(within(card).getByRole('heading', { name: 'Fundación Manglares Vivos' })).toBeInTheDocument()
    expect(within(card).getByText('NIT 900.123.456-8')).toBeInTheDocument()
    expect(within(card).getByText('Entidad sin ánimo de lucro')).toBeInTheDocument()
    expect(within(card).getByText('Datos completos y autorizados')).toBeInTheDocument()

    const digit = screen.getByRole('textbox', { name: 'Dígito de verificación' })
    await user.clear(digit)
    await user.type(digit, '3')
    expect(within(card).getByText('NIT 900.123.456-3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('No corresponde al NIT. Revisa el RUT.')).toBeInTheDocument()

    await user.clear(digit)
    await user.type(digit, '8')
    const phone = screen.getByRole('textbox', { name: 'Teléfono' })
    await user.clear(phone)
    await user.type(phone, '605 4321000')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(backend.store.accounts.get(1)).toMatchObject({ phone: '6054321000', verification_digit: '8', avatar_url: '/avatars/ana-gomez.jpg' })
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
