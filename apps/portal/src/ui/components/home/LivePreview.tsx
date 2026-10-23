// The hero's proof: one real published project, its verdict and its three measures filling in.
import type { PublicProjectCard } from '@agile/domain'
import { Icon, Pill } from '@agile/ui'
import { ArrowRight01Icon } from '@agile/ui/icons'
import { copShort } from '@agile/ui/transparency'
import { Link } from 'react-router-dom'
import { Bar } from './Bar'
import { LIGHTS } from './lights'

export function LivePreview({ card }: { card: PublicProjectCard }) {
  const light = LIGHTS[card.light]
  return (
    <Link
      to={`/p/${encodeURIComponent(card.slug)}`}
      aria-label={`Ver el proyecto ${card.name}`}
      className="rise group grid w-full max-w-md gap-4 rounded-xl bg-surface p-5 text-left shadow-float"
      style={{ ['--i' as string]: 5 }}
    >
      <div className="flex items-center justify-between gap-3">
        <Pill hue={light.hue} icon={light.icon}>
          {light.word}
        </Pill>
        <span className="text-caption text-ink-muted">{copShort(card.contract_value)}</span>
      </div>
      <div className="grid gap-1">
        <span className="text-heading">{card.name}</span>
        <span className="text-caption text-ink-muted">
          {card.contractor} para {card.contracting_entity}
        </span>
      </div>
      <div className="grid gap-2.5">
        <Bar name="Dinero usado" value={card.spent_pct} fill="bg-chart-1" animate={0} />
        <Bar name="Trabajo hecho" value={card.physical_pct} fill="bg-chart-2" animate={1} />
        <Bar name="Tiempo corrido" value={card.time_pct} fill="bg-ink-subtle" animate={2} />
      </div>
      <span className="inline-flex items-center gap-1.5 text-label text-ink-muted transition-[color] duration-150 group-hover:text-ink">
        Ver el proyecto
        <Icon icon={ArrowRight01Icon} size={16} />
      </span>
    </Link>
  )
}
