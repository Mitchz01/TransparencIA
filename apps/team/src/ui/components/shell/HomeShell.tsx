import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { recentProjects } from '../../../domain/launchpad'
import { useProjects } from '../../../application/use-cases/useProjects'
import { AgentSpark, cn, Drawer, Icon, IconButton, type IconGlyph } from '@agile/ui'
import { Add01Icon, Folder01Icon, Menu01Icon, Search01Icon, DashboardSquare01Icon } from '@agile/ui/icons'
import { AccountMenu } from './AccountMenu'
import { Brand, ThemeToggle } from './TopBar'

/** What the sidebar asks the home for; outside the home it goes there with it in the location state. */
export type HomeIntent = 'composer' | 'search' | 'projects'

const ROW = 'flex h-control-md w-full min-w-0 items-center gap-3 rounded-pill px-3 text-label transition-[color,background-color] duration-150'
const IDLE = 'text-ink-muted hover:bg-surface-strong hover:text-ink'

function NavButton({ icon, label, active, onClick }: { icon: IconGlyph; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={cn(ROW, active ? 'bg-primary text-on-primary' : IDLE)}>
      <Icon icon={icon} />
      {label}
    </button>
  )
}

interface SidebarProps {
  active?: 'new' | 'projects'
  onIntent: (intent: HomeIntent) => void
}

function Sidebar({ active, onIntent }: SidebarProps) {
  const { data: projects } = useProjects()
  const recent = recentProjects(projects ?? [], 4)
  const recentsId = useId()
  const team = recentProjects(projects ?? []).find((p) => p.permission === 'leader')

  const invite = (
    <>
      <AgentSpark size={24} />
      <span className="grid gap-1">
        <span className="text-label font-semibold">Invita a tu equipo</span>
        <span className="text-caption">Comparte el link de tu proyecto y planifiquen juntos.</span>
      </span>
    </>
  )

  return (
    <div className="flex min-h-full flex-col gap-8">
      <Brand withName className="self-start" />
      <nav aria-label="Inicio" className="grid gap-1">
        <NavButton icon={Add01Icon} label="Nuevo proyecto" active={active === 'new'} onClick={() => onIntent('composer')} />
        <NavButton icon={Search01Icon} label="Buscar" onClick={() => onIntent('search')} />
        <NavButton icon={DashboardSquare01Icon} label="Proyectos" active={active === 'projects'} onClick={() => onIntent('projects')} />
      </nav>
      {recent.length > 0 && (
        <section aria-labelledby={recentsId} className="grid gap-1">
          <h2 id={recentsId} className="px-3 pb-1 text-label text-ink-muted">Recientes</h2>
          <ul className="grid gap-1">
            {recent.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className={cn(ROW, IDLE)} title={project.name}>
                  <Icon icon={Folder01Icon} className="shrink-0" />
                  <span className="truncate">{project.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-auto grid gap-3">
        {team ? (
          <Link to={`/projects/${team.id}/team`} className="flex items-start gap-3 rounded-lg bg-primary-soft p-4 text-primary-soft-ink transition-opacity duration-150 hover:opacity-90">
            {invite}
          </Link>
        ) : (
          <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4 text-primary-soft-ink">{invite}</div>
        )}
        <div className="flex items-center justify-between gap-2 px-1">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </div>
  )
}

interface HomeShellProps {
  active?: 'new' | 'projects'
  /** The home handles the sidebar's actions itself; other screens leave this out and go home with the intent. */
  onIntent?: (intent: HomeIntent) => void
  children: ReactNode
}

/** The frame outside a project (spec 016): a sidebar with the brand, actions, recent projects and the account,
 *  and the screen in a panel next to it. Under 1024px the sidebar is a drawer opened from a minimal top bar. */
export function HomeShell({ active, onIntent, children }: HomeShellProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const intent = (next: HomeIntent) => {
    setMenuOpen(false)
    if (onIntent) onIntent(next)
    else navigate('/', { state: { focus: next } })
  }

  return (
    <div className="min-h-svh bg-bg lg:flex">
      <aside aria-label="Menú principal" className="sticky top-0 hidden h-svh w-[260px] shrink-0 overflow-y-auto px-3 py-4 [scrollbar-width:none] lg:block [&::-webkit-scrollbar]:hidden">
        <Sidebar active={active} onIntent={intent} />
      </aside>
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
        <Brand withName />
        <IconButton icon={Menu01Icon} label="Abrir menú" tooltipAlign="end" onClick={() => setMenuOpen(true)} />
      </div>
      {menuOpen && (
        <Drawer title="Menú" onClose={() => setMenuOpen(false)}>
          <Sidebar active={active} onIntent={intent} />
        </Drawer>
      )}
      <main id="main" className="min-w-0 flex-1 px-3 pb-3 lg:py-3 lg:pl-0">
        {children}
      </main>
    </div>
  )
}
