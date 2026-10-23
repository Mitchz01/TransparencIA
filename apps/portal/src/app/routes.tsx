import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { NotPublicPage, PublicPortalPage } from '../ui/pages/PublicPortalPage'

/** The portal only has one screen: a project's public page (spec 017, US3). Anything else isn't a portal. */
export const routes: RouteObject[] = [
  { path: '/p/:slug', element: <PublicPortalPage /> },
  { path: '*', element: <NotPublicPage /> },
]

export const createRouter = () => createBrowserRouter(routes)
