import type { Portal } from '@agile/domain'
import { EmptyState, SkeletonCard } from '@agile/ui'
import { Alert02Icon, ViewOffIcon } from '@agile/ui/icons'
import { AlertList, BudgetLines, PhaseStrip, WeeklyTimeline, WorkStatus } from '@agile/ui/transparency'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { isApiError } from '../../application/errors'
import { usePortal } from '../../application/usePortal'
import { ChatLauncher } from '../components/ChatLauncher'
import { HowToRead } from '../components/HowToRead'
import { PortalHero } from '../components/PortalHero'
import { Section } from '../components/Section'
import { SectionNav, type NavSection } from '../components/SectionNav'

function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-6 pb-28 md:px-8 md:pt-8 lg:pb-12">{children}</div>
}

/** A link that doesn't exist or isn't published (spec 017, US3 scenario 5). */
export function NotPublicPage() {
  return (
    <Page>
      <EmptyState icon={ViewOffIcon} title="Este proyecto no existe o no es público">
        Revisa el enlace o el código QR que te compartieron.
      </EmptyState>
    </Page>
  )
}

/** A project's public page (spec 017, US3). No app shell and no sign-in links. */
export function PublicPortalPage() {
  const { slug = '' } = useParams()
  const portal = usePortal(slug)

  if (portal.isPending) {
    return (
      <Page>
        <SkeletonCard lines={3} />
        <div className="grid gap-3 lg:grid-cols-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
        <SkeletonCard lines={8} />
      </Page>
    )
  }
  if (portal.isError) {
    if (isApiError(portal.error) && portal.error.status === 404) return <NotPublicPage />
    return (
      <Page>
        <EmptyState icon={Alert02Icon} title="No se pudo cargar el portal">
          Revisa tu conexión y vuelve a abrir el enlace.
        </EmptyState>
      </Page>
    )
  }
  return <PortalContent slug={slug} portal={portal.data} />
}

/** Phone: one column with jumps between sections. Desktop: the weeks on the left, each one with what was done and
 *  the evidence behind it; on the right, what's missing, the alerts and the budget lines. The chat is a button at
 *  the corner on every size. */
function PortalContent({ slug, portal }: { slug: string; portal: Portal }) {
  const pending = portal.alerts.filter((alert) => !alert.answer).length
  const sections: NavSection[] = [
    { id: 'semanas', label: 'Semana a semana' },
    ...(portal.sprints.length ? [{ id: 'falta', label: 'Lo que falta' }] : []),
    ...(portal.alerts.length ? [{ id: 'alertas', label: pending ? `Alertas (${pending})` : 'Alertas' }] : []),
    { id: 'rubros', label: 'Rubros' },
  ]
  return (
    <Page>
      <PortalHero portal={portal} />
      <SectionNav sections={sections} />

      {portal.sprints.length > 0 && (
        <Section id="fases" title="Fases del plan">
          <PhaseStrip sprints={portal.sprints} start={portal.project.start_date} />
        </Section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Section id="semanas" title="Semana a semana" hint="Qué se terminó, qué se pagó y con qué prueba. Toca una evidencia para verla completa.">
          <div className="rounded-lg bg-surface p-4 sm:p-6">
            <WeeklyTimeline timeline={portal.timeline} expenses={portal.expenses} sprints={portal.sprints} lines={portal.lines} end={portal.project.end_date} />
          </div>
        </Section>

        <aside className="grid min-w-0 content-start gap-10" aria-label="Para revisar">
          {portal.sprints.length > 0 && (
            <Section id="falta" title="Lo que falta">
              <WorkStatus sprints={portal.sprints} />
            </Section>
          )}
          {portal.alerts.length > 0 && (
            <Section id="alertas" title="Alertas" hint="Las marca la IA o una regla para que una persona revise. No se pueden borrar.">
              <div className="rounded-lg bg-surface p-4">
                <AlertList alerts={portal.alerts} />
              </div>
            </Section>
          )}
          <Section id="rubros" title="En qué se reparte la plata">
            <BudgetLines lines={portal.lines} />
          </Section>
        </aside>
      </div>
      <HowToRead />
      <ChatLauncher slug={slug} />
    </Page>
  )
}
