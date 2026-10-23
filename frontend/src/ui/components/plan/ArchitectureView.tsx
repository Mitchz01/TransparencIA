import type { Architecture } from '../../../domain/plan'
import { sentences } from '../../format'
import { Block, Card, Row, Rows } from '../ds'

/** The shape of the system: style, components, stack and the decisions behind it. */
export function ArchitectureView({ architecture }: { architecture: Architecture }) {
  return (
    <Card as="article" padding="lg" className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="text-heading">{architecture.style}</h2>
        <p className="text-body text-ink-muted">{architecture.summary}</p>
      </header>
      <Block title="Componentes">
        <Rows>
          {architecture.components.map((c) => (
            <Row key={c.name} title={c.name} detail={c.responsibility} aside={<span className="text-caption text-ink-muted">{c.technology}</span>} />
          ))}
        </Rows>
      </Block>
      <Block title="Stack">
        <Rows>
          {architecture.stack.map((s) => <Row key={s.layer} title={s.layer} detail={s.reason} aside={<span className="text-caption text-ink-muted">{s.technology}</span>} />)}
        </Rows>
      </Block>
      <Block title="Decisiones">
        <Rows>
          {architecture.decisions.map((d) => <Row key={d.title} title={d.title} detail={sentences(d.decision, d.rationale)} />)}
        </Rows>
      </Block>
    </Card>
  )
}
