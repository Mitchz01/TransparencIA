import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../application/theme'
import { Icon, IconButton } from '../ds'
import { Moon02Icon, Notification01Icon, Settings01Icon, Sun03Icon, Tick02Icon } from '../ds/icons'
import { ProjectSwitcher } from './ProjectSwitcher'
import { SectionMenu } from './SectionNav'

function Brand({ withName = false, className }: { withName?: boolean; className?: string }) {
  return (
    <Link to="/" className={`inline-flex shrink-0 items-center gap-2.5 rounded-pill ${className ?? ''}`} aria-label="Agile Planner, todos los proyectos">
      <span className="inline-flex size-9 items-center justify-center rounded-sm bg-primary text-on-primary">
        <Icon icon={Tick02Icon} />
      </span>
      {withName && <span className="text-label font-semibold">Agile Planner</span>}
    </Link>
  )
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'
  return <IconButton icon={theme === 'dark' ? Sun03Icon : Moon02Icon} label={label} tooltipAlign="end" onClick={toggle} />
}

function Bar({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 md:px-8">{children}</div>
    </header>
  )
}

/** Outside a project: the brand on the left, the theme on the right. */
export function HomeTopBar() {
  return (
    <Bar>
      <div className="flex h-control-md items-center justify-between gap-3">
        <Brand withName />
        <ThemeToggle />
      </div>
    </Bar>
  )
}

interface ProjectTopBarProps {
  projectId: number
  projectName: string
  onOpenActivity: () => void
  /** Receives the element where the current section renders its views. */
  viewsRef: (element: HTMLDivElement | null) => void
}

/** Inside a project: the project on the left, the section's views in the center, activity on the right.
 *  The sections live in the rail; under 768px they move into a menu here. */
export function ProjectTopBar({ projectId, projectName, onOpenActivity, viewsRef }: ProjectTopBarProps) {
  const navigate = useNavigate()
  return (
    <Bar>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1">
          <Brand className="md:hidden" />
          <ProjectSwitcher projectId={projectId} name={projectName} />
        </div>
        <div ref={viewsRef} className="col-span-2 row-start-3 flex min-w-0 justify-start overflow-x-auto empty:hidden md:row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center" />
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-3">
          <IconButton icon={Notification01Icon} label="Actividad" tooltipAlign="end" onClick={onOpenActivity} />
          <span className="contents md:hidden">
            <ThemeToggle />
            <IconButton icon={Settings01Icon} label="Ajustes" tooltipAlign="end" onClick={() => navigate(`/projects/${projectId}/settings`)} />
          </span>
        </div>
        <div className="col-span-2 md:hidden">
          <SectionMenu projectId={projectId} />
        </div>
      </div>
    </Bar>
  )
}
