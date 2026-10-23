import { useState } from 'react'
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { useLiveUpdates } from '../../application/liveUpdates'
import { useProject } from '../../application/use-cases/useProjects'
import type { Project } from '../../domain/project'
import { ActivityDrawer } from '../components/activity/ActivityDrawer'
import { SkeletonCard } from '../components/ds'
import { AppLayout } from '../components/shell/AppLayout'
import { ProjectRail } from '../components/shell/ProjectRail'
import { ProjectTopBar } from '../components/shell/TopBar'
import { TopBarViewsSlot } from '../components/shell/TopBarViews'
import { NotFoundPage } from './NotFoundPage'

function LiveUpdates({ projectId }: { projectId: number }) {
  useLiveUpdates(projectId)
  return null
}

/** Every project screen: the rail, the top bar, the live connection and the activity drawer. */
export function ProjectLayout() {
  const projectId = Number(useParams().projectId)
  const { data: project, notFound } = useProject(projectId)
  const [activityOpen, setActivityOpen] = useState(false)
  const [viewsSlot, setViewsSlot] = useState<HTMLDivElement | null>(null)

  if (notFound) return <NotFoundPage />

  return (
    <TopBarViewsSlot.Provider value={viewsSlot}>
      <AppLayout
        rail={<ProjectRail projectId={projectId} />}
        topBar={
          <ProjectTopBar
            projectId={projectId}
            projectName={project?.name ?? 'Proyecto'}
            onOpenActivity={() => setActivityOpen(true)}
            viewsRef={setViewsSlot}
          />
        }
      >
        {project ? (
          <>
            <LiveUpdates projectId={projectId} />
            <Outlet context={project} />
          </>
        ) : (
          <div className="grid gap-3 pt-10">
            <SkeletonCard lines={2} className="max-w-md" />
            <SkeletonCard lines={5} />
          </div>
        )}
        {activityOpen && <ActivityDrawer projectId={projectId} onClose={() => setActivityOpen(false)} />}
      </AppLayout>
    </TopBarViewsSlot.Provider>
  )
}

/** The project the current screen belongs to, already loaded by the layout. */
export const useCurrentProject = () => useOutletContext<Project>()

/** /projects/:id opens the board once the plan is applied, the planning before that. */
export function ProjectIndex() {
  const project = useCurrentProject()
  return <Navigate to={project.status === 'ready' ? 'board' : 'planning'} replace />
}
