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
          title="No encontrado"
          action={<ButtonLink to="/" variant="primary" icon={ArrowLeft01Icon}>Volver a los proyectos</ButtonLink>}
        >
          Este proyecto o página no existe. Puede que lo hayan borrado o que la dirección tenga un error.
        </EmptyState>
      </div>
    </AppLayout>
  )
}
