import type { QueryClient } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { queryKeys } from '../application/queryKeys'
import { isPublicPath, signInPath } from '../application/session'
import { RequireSession } from '../ui/components/shell/RequireSession'
import { ErrorPage } from '../ui/pages/ErrorPage'
import { NotFoundPage } from '../ui/pages/NotFoundPage'
import { ProjectIndex, ProjectLayout } from '../ui/pages/ProjectLayout'
import { ProjectsPage } from '../ui/pages/ProjectsPage'

// Each screen loads with its route, so the first load only brings the projects list and the shell
// (spec 009, SC-005). Only the documents screen brings the markdown renderer.
const screen = <T,>(load: () => Promise<T>, name: keyof T) => async () => ({
  Component: (await load())[name] as ComponentType,
})

/** Every screen of the screen map (spec 009). Only sign in, sign up and the join link work signed out (spec 015). */
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    // While the first screen's code arrives: the page background, no flash.
    hydrateFallbackElement: <div className="min-h-svh bg-bg" />,
    children: [
      { path: '/login', lazy: screen(() => import('../ui/pages/SignInPage'), 'SignInPage') },
      { path: '/signup', lazy: screen(() => import('../ui/pages/SignUpPage'), 'SignUpPage') },
      { path: '/join/:token', lazy: screen(() => import('../ui/pages/JoinPage'), 'JoinPage') },
      {
        element: <RequireSession />,
        children: [
          { path: '/', element: <ProjectsPage /> },
          { path: '/welcome', lazy: screen(() => import('../ui/pages/ProfilePage'), 'WelcomePage') },
          { path: '/profile', lazy: screen(() => import('../ui/pages/ProfilePage'), 'ProfilePage') },
          { path: '/projects/new', lazy: screen(() => import('../ui/pages/NewProjectPage'), 'NewProjectPage') },
          {
            path: '/projects/:projectId',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <ProjectIndex /> },
              { path: 'planning', lazy: screen(() => import('../ui/pages/PlanningPage'), 'PlanningPage') },
              { path: 'board', lazy: screen(() => import('../ui/pages/BoardPage'), 'BoardPage') },
              { path: 'transparency', lazy: screen(() => import('../ui/pages/TransparencyPage'), 'TransparencyPage') },
              { path: 'plan', lazy: screen(() => import('../ui/pages/PlanPage'), 'PlanPage') },
              { path: 'documents', lazy: screen(() => import('../ui/pages/DocumentsPage'), 'DocumentsPage') },
              { path: 'team', lazy: screen(() => import('../ui/pages/TeamPage'), 'TeamPage') },
              { path: 'integrations', lazy: screen(() => import('../ui/pages/IntegrationsPage'), 'IntegrationsPage') },
              { path: 'settings', lazy: screen(() => import('../ui/pages/SettingsPage'), 'SettingsPage') },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)

type Router = ReturnType<typeof createBrowserRouter>

/** The session ended (any call answered 401 not_authenticated): sign in, then back to where the person was.
 *  Signed out right away (so sign in doesn't bounce back); the rest of the cache goes once the screen has left. */
export const sessionEnded = (router: Router, client: QueryClient) => () => {
  const { pathname, search } = router.state.location
  if (isPublicPath(pathname)) return
  client.setQueryData(queryKeys.me(), null)
  void router
    .navigate(signInPath(pathname + search), { replace: true })
    .then(() => client.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me()[0] }))
}
