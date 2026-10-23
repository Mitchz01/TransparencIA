import type { Architecture, Component } from '../../../domain/plan'
import { groupByLayer } from '../../../domain/planViews'
import { sentences } from '../../format'
import { Block, Card, DisclosureRow, Icon, Rows, type IconGlyph } from '../ds'
import { AiBrain01Icon, BrowserIcon, CloudIcon, CubeIcon, DatabaseIcon, Layers01Icon, ServerStack01Icon } from '../ds/icons'

// A picture for each kind of component, read from its name and technology. Only a reading aid.
const KINDS: [RegExp, IconGlyph][] = [
  [/base de datos|database|\bdb\b|sql|postgres|mongo|redis|almacen|storage|persist/, DatabaseIcon],
  [/agente|agent|\bia\b|\bai\b|gemini|llm|gpt|modelo/, AiBrain01Icon],
  [/web|front|react|vue|angular|svelte|interfaz|\bui\b|\bspa\b|m[oó]vil|mobile/, BrowserIcon],
  [/api|backend|servidor|server|fastapi|django|express|node/, ServerStack01Icon],
  [/cloud|nube|deploy|infra|cola|queue/, CloudIcon],
]

const kindIcon = (c: Component) => KINDS.find(([pattern]) => pattern.test(`${c.name} ${c.technology}`.toLowerCase()))?.[1] ?? CubeIcon

function ComponentTile({ component }: { component: Component }) {
  return (
    <li className="flex items-start gap-3 rounded-md bg-surface p-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-strong text-ink">
        <Icon icon={kindIcon(component)} />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-label">{component.name}</span>
        <span className="text-caption text-ink-muted">{component.technology}</span>
        <span className="text-caption text-ink-muted">{component.responsibility}</span>
      </span>
    </li>
  )
}

/** The system as its stack layers, with the components that run on each one; decisions fold (spec 012). */
export function ArchitectureView({ architecture }: { architecture: Architecture }) {
  const groups = groupByLayer(architecture)
  const noStack = architecture.stack.length === 0
  return (
    <Card as="article" padding="lg" className="grid gap-8">
      <header className="grid gap-1">
        <h2 className="text-heading">{architecture.style}</h2>
        <p className="text-body text-ink-muted">{architecture.summary}</p>
      </header>

      <Block title="Mapa del sistema">
        <div className="grid gap-2">
          {groups.map(({ layer, components }) => {
            const name = layer?.layer ?? (noStack ? 'Componentes' : 'Otras piezas')
            return (
              <section key={name} aria-label={name} className="grid gap-3 rounded-md bg-inset p-4 md:grid-cols-[11rem_minmax(0,1fr)]">
                <div className="grid content-start gap-0.5">
                  <span className="flex items-center gap-2 text-label">
                    <Icon icon={Layers01Icon} className="shrink-0 text-ink-muted" />
                    {name}
                  </span>
                  {layer && <span className="text-caption text-ink">{layer.technology}</span>}
                  {layer && <span className="text-caption text-ink-muted">{layer.reason}</span>}
                </div>
                {components.length > 0 ? (
                  <ul className="grid content-start gap-2 sm:grid-cols-2">
                    {components.map((c) => <ComponentTile key={c.name} component={c} />)}
                  </ul>
                ) : (
                  <p className="self-center text-caption text-ink-muted">Ningún componente propio en esta capa.</p>
                )}
              </section>
            )
          })}
        </div>
      </Block>

      {architecture.decisions.length > 0 && (
        <Block title="Decisiones">
          <Rows>
            {architecture.decisions.map((d) => (
              <DisclosureRow key={d.title} title={d.title}>{sentences(d.decision, d.rationale)}</DisclosureRow>
            ))}
          </Rows>
        </Block>
      )}
    </Card>
  )
}
