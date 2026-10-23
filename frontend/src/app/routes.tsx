import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { BoardPage } from '../ui/pages/BoardPage'
import { DocumentsPage } from '../ui/pages/DocumentsPage'
import { ErrorPage } from '../ui/pages/ErrorPage'
import { IntegrationsPage } from '../ui/pages/IntegrationsPage'
import { NewProjectPage } from '../ui/pages/NewProjectPage'
import { NotFoundPage } from '../ui/pages/NotFoundPage'
import { PlanPage } from '../ui/pages/PlanPage'
import { PlanningPage } from '../ui/pages/PlanningPage'
import { ProjectIndex, ProjectLayout } from '../ui/pages/ProjectLayout'
import { ProjectsPage } from '../ui/pages/ProjectsPage'
import { SettingsPage } from '../ui/pages/SettingsPage'

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
          { path: 'integrations', element: <IntegrationsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
