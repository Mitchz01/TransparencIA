import { useNavigate } from 'react-router-dom'
import { useProjects } from '../../../application/use-cases/useProjects'
import { Menu } from '../ds'
import { Add01Icon, DashboardSquare01Icon } from '../ds/icons'
import { PROJECT_STATUS } from '../project/projectStatus'

/** The current project's name; opens the other projects, "All projects" and "New project". */
export function ProjectSwitcher({ projectId, name }: { projectId: number; name: string }) {
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()
  return (
    <Menu
      label={`Project: ${name}`}
      variant="quiet"
      className="min-w-0"
      buttonClassName="px-3 font-semibold text-ink!"
      items={projects.map((p) => ({
        key: String(p.id),
        label: p.name,
        caption: PROJECT_STATUS[p.status].label,
        selected: p.id === projectId,
        onSelect: () => navigate(`/projects/${p.id}`),
      }))}
      footer={[
        { key: 'all', label: 'All projects', icon: DashboardSquare01Icon, onSelect: () => navigate('/') },
        { key: 'new', label: 'New project', icon: Add01Icon, onSelect: () => navigate('/projects/new') },
      ]}
    >
      {name}
    </Menu>
  )
}
