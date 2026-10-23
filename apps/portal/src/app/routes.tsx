import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { PortalLayout } from '../ui/components/shell/PortalLayout'
import { HowItWorksPage } from '../ui/pages/HowItWorksPage'
import { NotPublicPage, PublicPortalPage } from '../ui/pages/PublicPortalPage'
import { SearchPage } from '../ui/pages/SearchPage'

/** The portal's home searches the published projects (US8); each one has its public page (US3). */
export const routes: RouteObject[] = [
  {
    element: <PortalLayout />,
    children: [
      { path: '/', element: <SearchPage /> },
      { path: '/como-funciona', element: <HowItWorksPage /> },
      { path: '/p/:slug', element: <PublicPortalPage /> },
      { path: '*', element: <NotPublicPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
