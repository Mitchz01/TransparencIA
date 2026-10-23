import { Link, NavLink } from 'react-router-dom'
import { useTheme } from '../../../application/theme'
import { cn, Icon, Tooltip, type IconGlyph } from '@agile/ui'
import { Moon02Icon, Settings01Icon, Sun03Icon, Tick02Icon } from '@agile/ui/icons'
import { SECTIONS } from './sections'

const item = 'inline-flex size-12 items-center justify-center rounded-md transition-[color,background-color] duration-150'
const idle = 'text-ink-muted hover:bg-surface-strong hover:text-ink'

function RailLink({ to, label, icon }: { to: string; label: string; icon: IconGlyph }) {
  return (
    <span className="group relative inline-flex">
      <NavLink to={to} aria-label={label} className={({ isActive }) => cn(item, isActive ? 'bg-primary text-on-primary' : idle)}>
        <Icon icon={icon} size={24} />
      </NavLink>
      <Tooltip text={label} placement="right" />
    </span>
  )
}

/** The sections as icons in a narrow column, theme and settings at the bottom (design system, "Navigation").
 *  Settings only for leaders: a member can't change them (spec 015). */
export function ProjectRail({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const { theme, toggle } = useTheme()
  const themeLabel = theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'
  return (
    <aside className="fixed top-3 bottom-3 left-3 z-40 hidden w-[72px] flex-col items-center rounded-lg bg-surface py-3 md:flex">
      <Link to="/" aria-label="Agile Planner, todos los proyectos" className="mb-6 inline-flex size-10 items-center justify-center rounded-sm bg-primary text-on-primary">
        <Icon icon={Tick02Icon} />
      </Link>
      <nav aria-label="Secciones" className="flex flex-col gap-2">
        {SECTIONS.map((s) => (
          <RailLink key={s.path} to={`/projects/${projectId}/${s.path}`} label={s.label} icon={s.icon} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <span className="group relative inline-flex">
          <button type="button" aria-label={themeLabel} onClick={toggle} className={cn(item, idle)}>
            <Icon icon={theme === 'dark' ? Sun03Icon : Moon02Icon} size={24} />
          </button>
          <Tooltip text={themeLabel} placement="right" />
        </span>
        {canManage && <RailLink to={`/projects/${projectId}/settings`} label="Ajustes" icon={Settings01Icon} />}
      </div>
    </aside>
  )
}
