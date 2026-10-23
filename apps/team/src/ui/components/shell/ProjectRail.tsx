import { Link, NavLink } from 'react-router-dom'
import { useTheme } from '../../../application/theme'
import { cn, Icon, type IconGlyph } from '@agile/ui'
import { ArrowLeft01Icon, Moon02Icon, Settings01Icon, Sun03Icon } from '@agile/ui/icons'
import { SECTIONS } from './sections'
import { Brand } from './TopBar'

const ROW = 'flex h-control-md w-full min-w-0 items-center gap-3 rounded-pill px-3 text-label transition-[color,background-color] duration-150'
const IDLE = 'text-ink-muted hover:bg-surface-strong hover:text-ink'

function SideLink({ to, label, icon }: { to: string; label: string; icon: IconGlyph }) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(ROW, isActive ? 'bg-primary text-on-primary' : IDLE)}>
      <Icon icon={icon} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

/** The project's menu: the sections with their names, so nobody has to guess an icon (spec 019).
 *  Settings only for leaders: a member can't change them (spec 015). Under 1024px the sections move to a menu in the top bar. */
export function ProjectRail({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const { theme, toggle } = useTheme()
  return (
    <aside aria-label="Menú del proyecto" className="fixed top-3 bottom-3 left-3 z-40 hidden w-[240px] flex-col gap-6 overflow-y-auto rounded-lg bg-surface p-3 lg:flex">
      <Brand withName className="px-1 pt-1" />
      <Link to="/" className={cn(ROW, IDLE)}>
        <Icon icon={ArrowLeft01Icon} className="shrink-0" />
        Mis proyectos
      </Link>
      <nav aria-label="Secciones" className="grid gap-1">
        {SECTIONS.map((s) => (
          <SideLink key={s.path} to={`/projects/${projectId}/${s.path}`} label={s.label} icon={s.icon} />
        ))}
      </nav>
      <div className="mt-auto grid gap-1">
        {canManage && <SideLink to={`/projects/${projectId}/settings`} label="Ajustes" icon={Settings01Icon} />}
        <button type="button" onClick={toggle} className={cn(ROW, IDLE)}>
          <Icon icon={theme === 'dark' ? Sun03Icon : Moon02Icon} className="shrink-0" />
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </button>
      </div>
    </aside>
  )
}
