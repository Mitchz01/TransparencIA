// The published projects as cards (spec 017, US8): verdict, alerts, who for whom, money against work.
import type { PublicProjectCard } from '@agile/domain'
import { Button, EmptyState, Icon, Pill, SkeletonCard } from '@agile/ui'
import { Alert02Icon, Calendar03Icon, Search01Icon } from '@agile/ui/icons'
import { copShort, day } from '@agile/ui/transparency'
import { Link } from 'react-router-dom'
import { Bar } from './Bar'
import { LIGHTS } from './lights'

interface ResultsProps {
  loading: boolean
  failed: boolean
  cards: PublicProjectCard[]
  filtered: boolean
  onClear: () => void
  onRetry: () => void
}

export function ProjectResults({ loading, failed, cards, filtered, onClear, onRetry }: ResultsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    )
  }
  if (failed) {
    return (
      <EmptyState icon={Alert02Icon} title="No se pudieron cargar los proyectos" action={<Button onClick={onRetry}>Volver a intentar</Button>}>
        Revisa tu conexión.
      </EmptyState>
    )
  }
  if (cards.length === 0) {
    return filtered ? (
      <EmptyState icon={Search01Icon} title="Ningún proyecto público coincide" action={<Button variant="secondary" onClick={onClear}>Ver todos los proyectos</Button>}>
        Prueba con otra palabra, como el municipio o la entidad que contrata.
      </EmptyState>
    ) : (
      <EmptyState icon={Search01Icon} title="Todavía no hay proyectos publicados" />
    )
  }
  return (
    <div className="grid gap-3">
      <p className="px-1 text-caption text-ink-muted" aria-live="polite">
        {cards.length === 1 ? '1 proyecto público' : `${cards.length} proyectos públicos`}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.slug} className="grid">
            <ProjectCard card={card} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProjectCard({ card }: { card: PublicProjectCard }) {
  const light = LIGHTS[card.light]
  return (
    <Link
      to={`/p/${encodeURIComponent(card.slug)}`}
      className="grid content-start gap-4 rounded-lg bg-surface p-5 transition-[background-color] duration-150 hover:bg-surface-strong"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill hue={light.hue} icon={light.icon}>
          {light.word}
        </Pill>
        {card.open_alerts > 0 && (
          <span className="text-caption text-ink-muted">{card.open_alerts === 1 ? '1 alerta en revisión' : `${card.open_alerts} alertas en revisión`}</span>
        )}
      </div>
      <div className="grid gap-1">
        <h3 className="text-heading">{card.name}</h3>
        <p className="text-caption text-ink-muted">
          {card.contractor} para {card.contracting_entity}
        </p>
      </div>
      <div className="grid gap-2.5">
        <Bar name="Dinero usado" value={card.spent_pct} fill="bg-chart-1" />
        <Bar name="Trabajo hecho" value={card.physical_pct} fill="bg-chart-2" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
        <span className="tabular-nums">{copShort(card.contract_value)}</span>
        <span className="inline-flex items-center gap-1.5">
          <Icon icon={Calendar03Icon} size={16} />
          Hasta el {day(card.end_date)}
        </span>
      </div>
    </Link>
  )
}
