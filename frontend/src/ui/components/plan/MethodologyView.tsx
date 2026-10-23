import type { Methodology } from '../../../domain/plan'
import type { MethodologyView as View } from '../../../domain/planViews'
import { Block, Card, Pill, Row, Rows } from '../ds'
import { AiMagicIcon, UserIcon } from '../ds/icons'
import { METHODOLOGY_NAMES } from '../planning/stageBodies'
import { plural } from '../../format'

const COLUMNS = { todo: 'Por hacer', in_progress: 'En curso', review: 'En revisión' } as const

/** How the team works: the decision, its rhythm and limits, and what was discarded and why. */
export function MethodologyView({ view }: { view: View }) {
  const { decision } = view
  const continuous = decision.methodology === 'kanban'
  return (
    <Card as="article" padding="lg" className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-heading">
            {continuous ? 'Kanban, flujo continuo' : `${METHODOLOGY_NAMES[decision.methodology]}, iteraciones de ${plural(decision.sprint_length_weeks, 'semana')}`}
          </h2>
          <p className="text-body text-ink-muted">{decision.rationale}</p>
        </div>
        {view.chosen_by === 'leader'
          ? <Pill hue="neutral" icon={UserIcon}>Elegida por ti</Pill>
          : <Pill hue="violet" icon={AiMagicIcon}>Elegida por los agentes</Pill>}
      </header>
      <Block title="Ceremonias">
        <Rows>
          {decision.ceremonies.map((c) => <Row key={c.name} title={c.name} detail={c.purpose} aside={<span className="text-caption text-ink-muted">{c.frequency}</span>} />)}
        </Rows>
      </Block>
      {decision.wip_limits.length > 0 && (
        <Block title="Límites WIP">
          <Rows>
            {decision.wip_limits.map((w) => (
              <Row key={w.column} title={COLUMNS[w.column]} aside={<span className="text-caption text-ink-muted tabular-nums">{plural(w.limit, 'tarea')} a la vez</span>} />
            ))}
          </Rows>
        </Block>
      )}
      {decision.alternatives.length > 0 && (
        <Block title="Descartadas">
          <Rows>
            {decision.alternatives.map((a) => <Row key={a.methodology} title={METHODOLOGY_NAMES[a.methodology as Methodology] ?? a.methodology} detail={a.why_not} />)}
          </Rows>
        </Block>
      )}
    </Card>
  )
}
