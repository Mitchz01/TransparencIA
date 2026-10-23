import { useRouteError } from 'react-router-dom'
import { Button, EmptyState } from '@agile/ui'
import { Alert02Icon, RefreshIcon } from '@agile/ui/icons'
import { AppLayout } from '../components/shell/AppLayout'
import { HomeTopBar } from '../components/shell/TopBar'

/** A screen crashed: say so plainly and offer a reload instead of a stack trace. */
export function ErrorPage() {
  console.error(useRouteError())
  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-lg pt-16">
        <EmptyState icon={Alert02Icon} title="Esta pantalla dejó de funcionar" action={<Button variant="primary" icon={RefreshIcon} onClick={() => window.location.reload()}>Recargar</Button>}>
          Recargar suele resolverlo. Tu trabajo está guardado.
        </EmptyState>
      </div>
    </AppLayout>
  )
}
