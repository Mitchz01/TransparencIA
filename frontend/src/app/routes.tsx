import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { Plug01Icon } from '../ui/components/ds/icons'
import { BoardPage } from '../ui/pages/BoardPage'
import { DocumentsPage } from '../ui/pages/DocumentsPage'
import { ErrorPage } from '../ui/pages/ErrorPage'
import { NewProjectPage } from '../ui/pages/NewProjectPage'
import { NotFoundPage } from '../ui/pages/NotFoundPage'
import { PlanPage } from '../ui/pages/PlanPage'
import { PlanningPage } from '../ui/pages/PlanningPage'
import { ProjectIndex, ProjectLayout } from '../ui/pages/ProjectLayout'
import { ProjectsPage } from '../ui/pages/ProjectsPage'
import { SettingsPage } from '../ui/pages/SettingsPage'
import { UpcomingPage } from '../ui/pages/UpcomingPage'

/** Every screen of the screen map (spec 009). */
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <ProjectsPage /> },
      { path: '/projects/new', element: <NewProjectPage /> },
      {
        path: '/projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectIndex /> },
          { path: 'planning', element: <PlanningPage /> },
          { path: 'board', element: <BoardPage /> },
          { path: 'plan', element: <PlanPage /> },
          { path: 'documents', element: <DocumentsPage /> },
          {
            path: 'integrations',
            element: <UpcomingPage title="Integraciones" icon={Plug01Icon}>Conecta un repo de GitHub y publica las tareas como issues.</UpcomingPage>,
          },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
