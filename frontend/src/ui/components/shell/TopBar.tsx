import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../application/theme'
import { Icon, IconButton } from '../ds'
import { Moon02Icon, Notification01Icon, Settings01Icon, Sun03Icon, Tick02Icon } from '../ds/icons'
import { ProjectSwitcher } from './ProjectSwitcher'
import { SectionMenu, SectionNav } from './SectionNav'

function Brand({ withName = false }: { withName?: boolean }) {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center gap-2.5 rounded-pill" aria-label="Agile Planner, all projects">
      <span className="inline-flex size-9 items-center justify-center rounded-sm bg-primary text-on-primary">
        <Icon icon={Tick02Icon} />
      </span>
      {withName && <span className="text-label font-semibold">Agile Planner</span>}
    </Link>
  )
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return <IconButton icon={theme === 'dark' ? Sun03Icon : Moon02Icon} label={`Switch to ${next} theme`} tooltipAlign="end" onClick={toggle} />
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
}

/** Inside a project: switcher left, sections center, activity, theme and settings right. No sidebar. */
export function ProjectTopBar({ projectId, projectName, onOpenActivity }: ProjectTopBarProps) {
  const navigate = useNavigate()
  return (
    <Bar>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-1">
          <Brand />
          <ProjectSwitcher projectId={projectId} name={projectName} />
        </div>
        <div className="hidden justify-center md:max-lg:col-span-2 md:max-lg:row-start-2 md:flex lg:col-auto lg:row-auto">
          <SectionNav projectId={projectId} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <IconButton icon={Notification01Icon} label="Activity" onClick={onOpenActivity} />
          <ThemeToggle />
          <IconButton icon={Settings01Icon} label="Settings" tooltipAlign="end" onClick={() => navigate(`/projects/${projectId}/settings`)} />
        </div>
        <div className="col-span-2 md:hidden">
          <SectionMenu projectId={projectId} />
        </div>
      </div>
    </Bar>
  )
}
