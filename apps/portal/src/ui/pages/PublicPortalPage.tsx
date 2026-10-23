import type { Portal } from '@agile/domain'
import { EmptyState, SkeletonCard } from '@agile/ui'
import { Alert02Icon, ViewOffIcon } from '@agile/ui/icons'
import { AlertList, BudgetLines, EvidenceList, WeeklyTimeline } from '@agile/ui/transparency'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { isApiError } from '../../application/errors'
import { usePortal } from '../../application/usePortal'
import { CitizenChat } from '../components/CitizenChat'
import { HowToRead } from '../components/HowToRead'
import { PortalHero } from '../components/PortalHero'
import { Section } from '../components/Section'
import { SectionNav, type NavSection } from '../components/SectionNav'

function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-6">{children}</main>
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

/** A project's public page (spec 017, US3), phone first. No app shell and no sign-in links. */
export function PublicPortalPage() {
  const { slug = '' } = useParams()
  const portal = usePortal(slug)

  if (portal.isPending) {
    return (
      <Page>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
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

function PortalContent({ slug, portal }: { slug: string; portal: Portal }) {
  const pending = portal.alerts.filter((alert) => !alert.answer).length
  const sections: NavSection[] = [
    ...(portal.alerts.length ? [{ id: 'alertas', label: pending ? `Alertas (${pending})` : 'Alertas' }] : []),
    { id: 'semanas', label: 'Semana a semana' },
    { id: 'rubros', label: 'Rubros' },
    { id: 'evidencias', label: `Evidencias (${portal.expenses.length})` },
    { id: 'preguntar', label: 'Preguntar' },
  ]
  return (
    <Page>
      <PortalHero portal={portal} />
      <SectionNav sections={sections} />
      {portal.alerts.length > 0 && (
        <Section id="alertas" title="Alertas" hint="Las detectan la IA o reglas automáticas para que una persona las revise. El ejecutor puede responderlas, no borrarlas.">
          <AlertList alerts={portal.alerts} />
        </Section>
      )}
      <Section id="semanas" title="Semana a semana" hint="Qué se terminó y cuánto se gastó cada semana, y cómo van sumando.">
        <WeeklyTimeline timeline={portal.timeline} />
      </Section>
      <Section id="rubros" title="En qué se reparte la plata" hint="Lo usado y lo que queda en cada rubro del presupuesto.">
        <BudgetLines lines={portal.lines} />
      </Section>
      <Section id="evidencias" title="Evidencias" hint="Facturas y fotos de campo que respaldan cada gasto y actividad.">
        <EvidenceList expenses={portal.expenses} lines={portal.lines} />
      </Section>
      <Section id="preguntar" title="Pregúntale al proyecto" hint="Responde con los datos de esta página.">
        <CitizenChat slug={slug} />
      </Section>
      <footer className="grid gap-3">
        <HowToRead />
        <p className="px-1 text-caption text-ink-muted">Datos reportados por el ejecutor y verificados por reglas automáticas. Ley 1712 de 2014.</p>
      </footer>
    </Page>
  )
}
