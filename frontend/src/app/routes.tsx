import { createBrowserRouter } from 'react-router-dom'
import { Calendar03Icon, File01Icon, Plug01Icon, Settings01Icon } from '../ui/components/ds/icons'
import { BoardPage } from '../ui/pages/BoardPage'
import { NewProjectPage } from '../ui/pages/NewProjectPage'
import { NotFoundPage } from '../ui/pages/NotFoundPage'
import { PlanningPage } from '../ui/pages/PlanningPage'
import { ProjectIndex, ProjectLayout } from '../ui/pages/ProjectLayout'
import { ProjectsPage } from '../ui/pages/ProjectsPage'
import { UpcomingPage } from '../ui/pages/UpcomingPage'

/** Every screen of the screen map (spec 009). */
export const routes = [
  { path: '/', element: <ProjectsPage /> },
  { path: '/projects/new', element: <NewProjectPage /> },
  {
    path: '/projects/:projectId',
    element: <ProjectLayout />,
    children: [
      { index: true, element: <ProjectIndex /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'board', element: <BoardPage /> },
      {
        path: 'plan',
        element: <UpcomingPage title="Plan" icon={Calendar03Icon}>The roadmap, the methodology and the architecture, each with where it came from.</UpcomingPage>,
      },
      {
        path: 'documents',
        element: <UpcomingPage title="Documents" icon={File01Icon}>The generated specs and diagrams, with their versions.</UpcomingPage>,
      },
      {
        path: 'integrations',
        element: <UpcomingPage title="Integrations" icon={Plug01Icon}>Connect a GitHub repo and publish the tasks as issues.</UpcomingPage>,
      },
      {
        path: 'settings',
        element: <UpcomingPage title="Settings" icon={Settings01Icon}>Edit the project, its team and auto-approve.</UpcomingPage>,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const createRouter = () => createBrowserRouter(routes)
