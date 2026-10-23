import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { ErrorPage } from '../ui/pages/ErrorPage'
import { NotFoundPage } from '../ui/pages/NotFoundPage'
import { ProjectIndex, ProjectLayout } from '../ui/pages/ProjectLayout'
import { ProjectsPage } from '../ui/pages/ProjectsPage'

// Each screen loads with its route, so the first load only brings the projects list and the shell
// (spec 009, SC-005). Only the documents screen brings the markdown renderer.
const screen = <T,>(load: () => Promise<T>, name: keyof T) => async () => ({
  Component: (await load())[name] as ComponentType,
})

/** Every screen of the screen map (spec 009). */
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <ProjectsPage /> },
      { path: '/projects/new', lazy: screen(() => import('../ui/pages/NewProjectPage'), 'NewProjectPage') },
      {
        path: '/projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectIndex /> },
          { path: 'planning', lazy: screen(() => import('../ui/pages/PlanningPage'), 'PlanningPage') },
          { path: 'board', lazy: screen(() => import('../ui/pages/BoardPage'), 'BoardPage') },
          { path: 'plan', lazy: screen(() => import('../ui/pages/PlanPage'), 'PlanPage') },
          { path: 'documents', lazy: screen(() => import('../ui/pages/DocumentsPage'), 'DocumentsPage') },
          { path: 'integrations', lazy: screen(() => import('../ui/pages/IntegrationsPage'), 'IntegrationsPage') },
          { path: 'settings', lazy: screen(() => import('../ui/pages/SettingsPage'), 'SettingsPage') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
