import type { Portal } from '@agile/domain'
import { Card, EmptyState, SkeletonCard } from '@agile/ui'
import { Alert02Icon, ViewOffIcon } from '@agile/ui/icons'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { isApiError } from '../../application/errors'
import { usePortal } from '../../application/usePortal'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto grid max-w-2xl gap-4 px-4 py-8">{children}</main>
}

/** A link that doesn't exist or isn't published (spec 017, US3 scenario 5). */
export function NotPublicPage() {
  return (
    <Page>
      <EmptyState icon={ViewOffIcon} title="Este proyecto no existe o no es público" />
    </Page>
  )
}

/** A project's public page (spec 017, US3). The sections of the portal (traffic light, timeline,
 *  budget lines, evidence, alerts, chat) come in with spec 017's tasks T020 and T022. */
export function PublicPortalPage() {
  const { slug = '' } = useParams()
  const portal = usePortal(slug)

  if (portal.isPending) {
    return (
      <Page>
        <SkeletonCard lines={4} />
      </Page>
    )
  }
  if (portal.isError) {
    if (isApiError(portal.error) && portal.error.status === 404) return <NotPublicPage />
    return (
      <Page>
        <EmptyState icon={Alert02Icon} title="No pudimos cargar el portal">
          Revisa tu conexión e inténtalo de nuevo.
        </EmptyState>
      </Page>
    )
  }
  return (
    <Page>
      <ProjectHeader portal={portal.data} />
    </Page>
  )
}

function ProjectHeader({ portal }: { portal: Portal }) {
  const { project } = portal
  return (
    <Card>
      <h1 className="text-title">{project.name}</h1>
      <p className="mt-2 text-body text-ink-muted">{project.description}</p>
      <p className="mt-4 text-label">
        {project.contractor} ejecuta para {project.contracting_entity} un contrato de {cop.format(project.contract_value)}
      </p>
    </Card>
  )
}
