import { useLocation, useNavigate } from 'react-router-dom'
import { Menu } from '../ds'
import { SECTIONS } from './sections'

/** Under 768px the rail hides and the sections live in a menu that names the current one. */
export function SectionMenu({ projectId }: { projectId: number }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const current = SECTIONS.find((s) => pathname.startsWith(`/projects/${projectId}/${s.path}`))
  return (
    <Menu
      label={`Sección: ${current?.label ?? 'Ajustes'}`}
      icon={current?.icon}
      className="w-full"
      buttonClassName="w-full justify-start bg-surface [&>span]:flex-1 [&>span]:text-left"
      items={SECTIONS.map((s) => ({
        key: s.path,
        label: s.label,
        icon: s.icon,
        selected: s === current,
        onSelect: () => navigate(`/projects/${projectId}/${s.path}`),
      }))}
    >
      {current?.label ?? 'Ajustes'}
    </Menu>
  )
}
