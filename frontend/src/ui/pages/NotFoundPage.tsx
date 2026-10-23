import { ButtonLink, EmptyState } from '../components/ds'
import { ArrowLeft01Icon, Folder01Icon } from '../components/ds/icons'
import { AppLayout } from '../components/shell/AppLayout'
import { HomeTopBar } from '../components/shell/TopBar'

export function NotFoundPage() {
  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-lg pt-16">
        <EmptyState
          icon={Folder01Icon}
          title="Not found"
          action={<ButtonLink to="/" variant="primary" icon={ArrowLeft01Icon}>Back to projects</ButtonLink>}
        >
          This project or page doesn’t exist. It may have been removed, or the address has a typo.
        </EmptyState>
      </div>
    </AppLayout>
  )
}
