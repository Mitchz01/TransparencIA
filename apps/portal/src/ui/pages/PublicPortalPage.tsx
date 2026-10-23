import type { Portal } from '@agile/domain'
import { Card, EmptyState, Icon, SkeletonCard } from '@agile/ui'
import { Alert02Icon, Calendar03Icon, ViewOffIcon } from '@agile/ui/icons'
import { AlertList, BudgetLines, cop, day, EvidenceList, ProgressBars, TrafficLight, WeeklyTimeline } from '@agile/ui/transparency'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { isApiError } from '../../application/errors'
import { usePortal } from '../../application/usePortal'
import { CitizenChat } from '../components/CitizenChat'

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

/** A project's public page (spec 017, US3), phone first. No app shell and no sign-in links. */
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
  const data = portal.data
  return (
    <Page>
      <ProjectHeader portal={data} />
      <TrafficLight summary={data.summary} />
      <ProgressBars summary={data.summary} />
      <WeeklyTimeline timeline={data.timeline} />
      <BudgetLines lines={data.lines} />
      <EvidenceList expenses={data.expenses} lines={data.lines} />
      {data.alerts.length > 0 && (
        <section className="grid gap-3" aria-labelledby="alerts-title">
          <h2 id="alerts-title" className="text-heading">
            Alertas
          </h2>
          <AlertList alerts={data.alerts} />
        </section>
      )}
      <CitizenChat slug={slug} />
      <footer className="px-1 pt-2 text-caption text-ink-muted">
        Datos reportados por el ejecutor y verificados por reglas automáticas. Ley 1712 de 2014.
      </footer>
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
        {project.contractor} ejecuta para {project.contracting_entity} un contrato de {cop(project.contract_value)}
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-caption text-ink-muted">
        <Icon icon={Calendar03Icon} size={16} />
        Del {day(project.start_date)} al {day(project.end_date)}
      </p>
    </Card>
  )
}
