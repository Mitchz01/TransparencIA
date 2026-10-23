import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { signInPath } from '../../../application/session'
import { useMe } from '../../../application/use-cases/useSession'
import { Button, EmptyState } from '../ds'
import { Alert02Icon, RefreshIcon } from '../ds/icons'

/** Every screen but sign in, sign up and the join link needs a session (spec 015, FR-004).
 *  While it's checked: the page background, no flash. Without one: sign in, then back here. */
export function RequireSession() {
  const { data: me, isPending, isError, refetch } = useMe()
  const { pathname, search } = useLocation()

  if (isPending) return <div className="min-h-svh bg-bg" />
  if (isError) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-24">
        <EmptyState icon={Alert02Icon} title="No hay conexión con el servidor" action={<Button variant="primary" icon={RefreshIcon} onClick={() => void refetch()}>Reintentar</Button>}>
          No pudimos saber si tienes la sesión abierta. Revisa la conexión y vuelve a intentarlo.
        </EmptyState>
      </div>
    )
  }
  if (!me) return <Navigate to={signInPath(pathname + search)} replace />
  return <Outlet />
}
