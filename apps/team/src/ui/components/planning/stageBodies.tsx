import { useState, type ReactNode } from 'react'
import type { Level, Methodology, StageKey, StageOutputs } from '../../../domain/plan'
import { plural, points, sentences } from '../../format'
import { Block, Button, Pill, Row, Rows, StateLabel } from '@agile/ui'
import { Flag02Icon } from '@agile/ui/icons'

export interface Fact {
  value: string
  name: string
}

export interface StageSummary {
  title: string
  facts: Fact[] // at most three: they're the screen's numbers
  body: ReactNode
}

export const METHODOLOGY_NAMES: Record<Methodology, string> = { scrum: 'Scrum', kanban: 'Kanban', scrumban: 'Scrumban', xp: 'XP', shape_up: 'Shape Up' }
export const LEVELS: Record<Level, string> = { low: 'Baja', medium: 'Media', high: 'Alta' }
const PRIORITY_HUE = { high: 'coral', medium: 'amber', low: 'teal' } as const

const listText = (items: string[]) => (items.length <= 3 ? items.join(', ') : `${items.slice(0, 3).join(', ')} y ${items.length - 3} más`)

const SHORT = 5

/** The first few rows, and the rest on demand: the card stays short. */
function ShortList<T>({ items, noun, render }: { items: T[]; noun: string; render: (item: T) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const shown = open ? items : items.slice(0, SHORT)
  return (
    <div className="grid gap-2">
      <Rows>{shown.map(render)}</Rows>
      {items.length > SHORT && (
        <div>
          <Button size="sm" variant="quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Ver menos' : `Ver las ${items.length} ${noun}`}
          </Button>
        </div>
      )}
    </div>
  )
}

function analysis(c: StageOutputs['analysis']): StageSummary {
  const high = c.risks.filter((r) => r.impact === 'high').length
  return {
    title: 'Alcance, objetivos y riesgos',
    facts: [
      { value: LEVELS[c.complexity], name: 'Complejidad' },
      { value: plural(c.goals.length, 'objetivo'), name: listText(c.goals) },
      { value: plural(c.risks.length, 'riesgo'), name: high ? `${high} de impacto alto` : 'Ninguno de impacto alto' },
    ],
    body: (
      <>
        <p className="text-body">{c.summary}</p>
        <Block title="Dentro del alcance">
          <p className="text-body text-ink-muted">{c.in_scope.join(', ')}.</p>
        </Block>
        {c.out_of_scope.length > 0 && (
          <Block title="Fuera del alcance">
            <p className="text-body text-ink-muted">{c.out_of_scope.join(', ')}.</p>
          </Block>
        )}
        <Block title="Riesgos">
          <Rows>
            {c.risks.map((r) => (
              <Row key={r.description} title={r.description} detail={r.mitigation} aside={<Pill hue={PRIORITY_HUE[r.impact]} icon={Flag02Icon}>{LEVELS[r.impact]}</Pill>} />
            ))}
          </Rows>
        </Block>
        {c.team_gaps.length > 0 && (
          <Block title="Lo que le falta al equipo">
            <p className="text-body text-ink-muted">{c.team_gaps.join(', ')}.</p>
          </Block>
        )}
      </>
    ),
  }
}

function methodology(c: StageOutputs['methodology']): StageSummary {
  const wip = c.wip_limits.find((w) => w.column === 'in_progress')
  const continuous = c.methodology === 'kanban'
  return {
    title: continuous ? 'Kanban, flujo continuo' : `${METHODOLOGY_NAMES[c.methodology]}, iteraciones de ${plural(c.sprint_length_weeks, 'semana')}`,
    facts: [
      { value: continuous ? 'Continua' : plural(c.sprint_length_weeks, 'semana'), name: 'Iteración' },
      { value: plural(c.ceremonies.length, 'ceremonia'), name: listText(c.ceremonies.map((x) => x.name)) },
      ...(wip ? [{ value: `${wip.limit} en curso`, name: 'Límite WIP' }] : []),
    ],
    body: (
      <>
        <Block title="Ceremonias">
          <Rows>
            {c.ceremonies.map((x) => <Row key={x.name} title={x.name} detail={sentences(x.frequency, x.purpose)} />)}
          </Rows>
        </Block>
        {c.alternatives.length > 0 && (
          <Block title="Descartadas">
            <Rows>
              {c.alternatives.map((a) => <Row key={a.methodology} title={METHODOLOGY_NAMES[a.methodology as Methodology] ?? a.methodology} detail={a.why_not} />)}
            </Rows>
          </Block>
        )}
      </>
    ),
  }
}

function architecture(c: StageOutputs['architecture']): StageSummary {
  return {
    title: c.style,
    facts: [
      { value: plural(c.components.length, 'componente'), name: listText(c.components.map((x) => x.name)) },
      { value: plural(c.stack.length, 'capa'), name: listText(c.stack.map((x) => x.technology)) },
      { value: plural(c.decisions.length, 'decisión', 'decisiones'), name: listText(c.decisions.map((x) => x.title)) },
    ],
    body: (
      <>
        <p className="text-body">{c.summary}</p>
        <Block title="Componentes">
          <Rows>
            {c.components.map((x) => <Row key={x.name} title={x.name} detail={x.responsibility} aside={<span className="text-caption text-ink-muted">{x.technology}</span>} />)}
          </Rows>
        </Block>
        <Block title="Decisiones">
          <Rows>
            {c.decisions.map((x) => <Row key={x.title} title={x.decision} detail={x.rationale} />)}
          </Rows>
        </Block>
      </>
    ),
  }
}

function roadmap(c: StageOutputs['roadmap']): StageSummary {
  const weeks = Math.max(0, ...c.phases.map((p) => p.end_week))
  const epics = c.phases.flatMap((p) => p.epics)
  return {
    title: `${plural(c.phases.length, 'fase')} en ${plural(weeks, 'semana')}`,
    facts: [
      { value: plural(c.phases.length, 'fase'), name: listText(c.phases.map((p) => p.name)) },
      { value: plural(weeks, 'semana'), name: 'De principio a fin' },
      { value: plural(epics.length, 'épica'), name: listText(epics.map((e) => e.title)) },
    ],
    body: (
      <Block title="Fases">
        <Rows>
          {c.phases.map((p) => (
            <Row
              key={p.name}
              title={p.name}
              detail={sentences(p.goal, p.epics.map((e) => `${e.key} ${e.title}`).join(', '))}
              aside={<span className="text-caption whitespace-nowrap text-ink-muted tabular-nums">{p.start_week === p.end_week ? `Semana ${p.start_week}` : `Semanas ${p.start_week} a ${p.end_week}`}</span>}
            />
          ))}
        </Rows>
      </Block>
    ),
  }
}

function backlog(c: StageOutputs['backlog']): StageSummary {
  const epics = [...new Set(c.stories.map((s) => s.epic_key))]
  const total = c.stories.reduce((sum, s) => sum + s.points, 0)
  return {
    title: `${plural(c.stories.length, 'historia')} en ${plural(epics.length, 'épica')}`,
    facts: [
      { value: plural(c.stories.length, 'historia'), name: `${c.stories.filter((s) => s.priority === 'high').length} de prioridad alta` },
      { value: points(total), name: 'Estimados' },
      { value: plural(epics.length, 'épica'), name: listText(epics) },
    ],
    body: (
      <Block title="Historias">
        <ShortList
          items={c.stories}
          noun="historias"
          render={(s) => (
            <Row
              key={s.key}
              title={<span className="flex gap-2"><span className="shrink-0 text-key whitespace-nowrap text-ink-muted">{s.key}</span>{s.title}</span>}
              detail={`${s.epic_key}, ${s.role}`}
              aside={
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-key text-ink-muted">{points(s.points)}</span>
                  <StateLabel hue={PRIORITY_HUE[s.priority]} icon={Flag02Icon} className="w-16">{LEVELS[s.priority]}</StateLabel>
                </span>
              }
            />
          )}
        />
      </Block>
    ),
  }
}

function sprints(c: StageOutputs['sprints']): StageSummary {
  const sizes = c.sprints.map((s) => s.story_keys.length)
  return {
    title: plural(c.sprints.length, 'sprint'),
    facts: [
      { value: plural(c.sprints.length, 'sprint'), name: listText(c.sprints.map((s) => s.phase)) },
      { value: plural(Math.max(0, ...sizes), 'historia'), name: 'En el sprint más cargado' },
      { value: plural(sizes.reduce((a, b) => a + b, 0), 'historia'), name: 'En todos los sprints' },
    ],
    body: (
      <Block title="Sprints">
        <Rows>
          {c.sprints.map((s) => <Row key={s.number} title={s.name} detail={sentences(s.goal, s.story_keys.join(', '))} aside={<span className="text-caption text-ink-muted">{s.phase}</span>} />)}
        </Rows>
      </Block>
    ),
  }
}

export function summarizeStage(key: StageKey, content: Record<string, unknown>): StageSummary {
  const c = content as never
  switch (key) {
    case 'analysis': return analysis(c)
    case 'methodology': return methodology(c)
    case 'architecture': return architecture(c)
    case 'roadmap': return roadmap(c)
    case 'backlog': return backlog(c)
    case 'sprints': return sprints(c)
  }
}
