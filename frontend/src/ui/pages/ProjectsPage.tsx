import { Link } from 'react-router-dom'
import { useProjects } from '../../application/use-cases/useProjects'
import type { ProjectSummary } from '../../domain/project'
import { ButtonLink, EmptyState, Icon, Pill, SkeletonCard } from '../components/ds'
import { Add01Icon, Calendar03Icon, Clock01Icon, Folder01Icon, UserGroupIcon } from '../components/ds/icons'
import { PROJECT_STATUS } from '../components/project/projectStatus'
import { AppLayout } from '../components/shell/AppLayout'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeTopBar } from '../components/shell/TopBar'
import { formatDate, plural } from '../format'

function ProjectCard({ project }: { project: ProjectSummary }) {
  const status = PROJECT_STATUS[project.status]
  return (
    <Link
      to={`/projects/${project.id}`}
      className="grid content-between gap-6 rounded-lg bg-surface p-5 transition-[background-color] duration-150 hover:bg-surface-strong sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-heading break-words">{project.name}</h2>
        <Pill hue={status.hue} icon={status.icon}>{status.label}</Pill>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted tabular-nums">
        <span className="inline-flex items-center gap-1.5"><Icon icon={Clock01Icon} size={16} />{plural(project.duration_weeks, 'week')}</span>
        <span className="inline-flex items-center gap-1.5"><Icon icon={UserGroupIcon} size={16} />{plural(project.member_count, 'member')}</span>
        <span className="inline-flex items-center gap-1.5"><Icon icon={Calendar03Icon} size={16} />{formatDate(project.created_at)}</span>
      </div>
    </Link>
  )
}

export function ProjectsPage() {
  const { data: projects, isPending } = useProjects()
  const newProject = <ButtonLink to="/projects/new" variant="primary" icon={Add01Icon}>New project</ButtonLink>
  return (
    <AppLayout topBar={<HomeTopBar />}>
      <PageHeader title="Projects" description="Describe what you want to build. The agents plan it, you decide." actions={projects?.length ? newProject : undefined} />
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : projects?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="grid">
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Folder01Icon} title="No projects yet" action={newProject}>
          Start with a description and your team. The agents take it from there.
        </EmptyState>
      )}
    </AppLayout>
  )
}
