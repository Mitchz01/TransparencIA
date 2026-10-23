// The portal's frame, the public side of TransparencIA: the same brand, theme toggle and look as the team app.
import { buttonClasses, cn, Drawer, Icon, IconButton } from '@agile/ui'
import { Login01Icon, Menu01Icon, Moon02Icon, Sun03Icon, Tick02Icon } from '@agile/ui/icons'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { TEAM_APP_URL } from '../../../application/links'
import { useTheme } from '../../../application/theme'

const LINKS = [
  { to: '/', label: 'Proyectos', end: true },
  { to: '/como-funciona', label: 'Cómo funciona', end: false },
]

function Brand() {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center gap-2.5 rounded-pill" aria-label="TransparencIA, inicio">
      <span className="inline-flex size-9 items-center justify-center rounded-sm bg-primary text-on-primary">
        <Icon icon={Tick02Icon} />
      </span>
      <span className="grid leading-tight">
        <span className="text-label font-semibold">TransparencIA</span>
        <span className="text-caption text-ink-muted">Portal ciudadano</span>
      </span>
    </Link>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'
  return <IconButton icon={theme === 'dark' ? Sun03Icon : Moon02Icon} label={label} tooltipAlign="end" onClick={toggle} />
}

function NavLinks({ vertical = false }: { vertical?: boolean }) {
  return (
    <ul className={cn('flex gap-1', vertical && 'grid')}>
      {LINKS.map((link) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'flex h-control-md items-center rounded-pill px-4 text-label transition-[color,background-color] duration-150',
                isActive ? 'bg-surface-strong text-ink' : 'text-ink-muted hover:text-ink',
              )
            }
          >
            {link.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

const signIn = (className?: string) => (
  <a href={`${TEAM_APP_URL}/login`} className={buttonClasses('primary', 'md', className)}>
    <Icon icon={Login01Icon} />
    Soy ejecutor
  </a>
)

/** Transparent over the page, with a fill once it scrolls under (like the team app's top bar). */
function TopBar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return (
    <header className={cn('sticky top-0 z-30 transition-[background-color] duration-150', scrolled && 'bg-bg/90 backdrop-blur-md')}>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Brand />
        <nav aria-label="Principal" className="hidden md:block">
          <NavLinks />
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden md:block">{signIn('h-control-md px-5')}</span>
          <span className="md:hidden">
            <IconButton icon={Menu01Icon} label="Abrir menú" tooltipAlign="end" onClick={() => setMenuOpen(true)} />
          </span>
        </div>
      </div>
      {menuOpen && (
        <Drawer title="Menú" onClose={() => setMenuOpen(false)}>
          {/* A tap on any link closes the menu (the click bubbles up from it). */}
          <nav aria-label="Principal" className="grid gap-6" onClick={() => setMenuOpen(false)}>
            <NavLinks vertical />
            {signIn('h-control-lg px-5')}
          </nav>
        </Drawer>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-12 pb-10 md:px-8">
      <div className="grid gap-6 rounded-lg bg-surface p-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Brand />
          <p className="max-w-sm text-caption text-ink-muted">
            Cada ejecutor reporta sus gastos con evidencia; reglas fijas calculan el avance y el semáforo. Cualquiera puede revisarlo, sin cuenta.
          </p>
        </div>
        <nav aria-label="Portal" className="grid content-start gap-2 text-label">
          <span className="text-caption text-ink-muted">Portal</span>
          <Link to="/" className="text-ink-muted hover:text-ink">Proyectos</Link>
          <Link to="/como-funciona" className="text-ink-muted hover:text-ink">Cómo funciona</Link>
          <a href={`${TEAM_APP_URL}/login`} className="text-ink-muted hover:text-ink">Entrar como ejecutor</a>
        </nav>
        <div className="grid content-start gap-2 text-caption text-ink-muted">
          <span>Marco legal</span>
          <span>Ley 1712 de 2014, transparencia y acceso a la información pública</span>
          <span>Ley 850 de 2003, veedurías ciudadanas</span>
        </div>
      </div>
      <p className="px-1 text-caption text-ink-subtle">Datos reportados por cada ejecutor y verificados por reglas automáticas.</p>
    </footer>
  )
}

export function PortalLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-pill focus:bg-inverse focus:px-4 focus:py-2 focus:text-on-inverse">
        Ir al contenido
      </a>
      <TopBar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
