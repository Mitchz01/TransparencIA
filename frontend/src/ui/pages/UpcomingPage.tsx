import { ButtonLink, EmptyState, type IconGlyph } from '../components/ds'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

interface UpcomingPageProps {
  title: string
  icon: IconGlyph
  children: string
}

/** A section whose screen comes in a later round: says so and points to what already works. */
export function UpcomingPage({ title, icon, children }: UpcomingPageProps) {
  const project = useCurrentProject()
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={icon}
        title="Coming in the next round"
        action={<ButtonLink to={`/projects/${project.id}/${project.status === 'ready' ? 'board' : 'planning'}`}>Back to {project.status === 'ready' ? 'the board' : 'planning'}</ButtonLink>}
      >
        {children}
      </EmptyState>
    </>
  )
}
