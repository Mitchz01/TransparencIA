import { useRouteError } from 'react-router-dom'
import { Button, EmptyState } from '../components/ds'
import { Alert02Icon, RefreshIcon } from '../components/ds/icons'
import { AppLayout } from '../components/shell/AppLayout'
import { HomeTopBar } from '../components/shell/TopBar'

/** A screen crashed: say so plainly and offer a reload instead of a stack trace. */
export function ErrorPage() {
  console.error(useRouteError())
  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-lg pt-16">
        <EmptyState icon={Alert02Icon} title="This screen stopped working" action={<Button variant="primary" icon={RefreshIcon} onClick={() => window.location.reload()}>Reload</Button>}>
          Reloading usually fixes it. Your work is saved.
        </EmptyState>
      </div>
    </AppLayout>
  )
}
