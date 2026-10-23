import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn, Menu } from '../ds'
import { Menu01Icon } from '../ds/icons'
import { SECTIONS } from './sections'

/** The sections as a pill group; the active one in `primary`. */
export function SectionNav({ projectId }: { projectId: number }) {
  return (
    <nav aria-label="Secciones" className="inline-flex gap-1 rounded-pill bg-surface p-1">
      {SECTIONS.map((section) => (
        <NavLink
          key={section.path}
          to={`/projects/${projectId}/${section.path}`}
          className={({ isActive }) =>
            cn(
              'inline-flex h-control-md items-center rounded-pill px-4 text-label whitespace-nowrap transition-[color,background-color] duration-150',
              isActive ? 'bg-primary text-on-primary' : 'text-ink-muted hover:text-ink',
            )
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Under 768px the sections collapse into a menu that names the current one. */
export function SectionMenu({ projectId }: { projectId: number }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const current = SECTIONS.find((s) => pathname.startsWith(`/projects/${projectId}/${s.path}`))
  return (
    <Menu
      label={`Sección: ${current?.label ?? 'Ajustes'}`}
      icon={Menu01Icon}
      className="w-full"
      buttonClassName="w-full justify-start bg-surface [&>span]:flex-1 [&>span]:text-left"
      items={SECTIONS.map((s) => ({
        key: s.path,
        label: s.label,
        selected: s === current,
        onSelect: () => navigate(`/projects/${projectId}/${s.path}`),
      }))}
    >
      {current?.label ?? 'Ajustes'}
    </Menu>
  )
}
