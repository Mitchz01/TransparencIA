import type { ReactNode } from 'react'
import type { Level, Methodology, StageKey, StageOutputs } from '../../../domain/plan'
import { useState } from 'react'
import { Button, Pill, StateLabel } from '../ds'
import { Flag02Icon } from '../ds/icons'
import { plural, points } from '../../format'

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
const LEVELS: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High' }
const PRIORITY_HUE = { high: 'coral', medium: 'amber', low: 'teal' } as const

const listText = (items: string[]) => (items.length <= 3 ? items.join(', ') : `${items.slice(0, 3).join(', ')} and ${items.length - 3} more`)

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-label text-ink">{title}</h3>
      {children}
    </section>
  )
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="grid gap-1.5">{children}</ul>
}

function Row({ title, detail, aside }: { title: ReactNode; detail?: ReactNode; aside?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-md bg-inset px-4 py-3">
      <span className="grid min-w-0 gap-0.5">
        <span className="text-label">{title}</span>
        {detail && <span className="text-caption text-ink-muted">{detail}</span>}
      </span>
      {aside}
    </li>
  )
}

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
            {open ? 'Show fewer' : `Show all ${items.length} ${noun}`}
          </Button>
        </div>
      )}
    </div>
  )
}

function analysis(c: StageOutputs['analysis']): StageSummary {
  const high = c.risks.filter((r) => r.impact === 'high').length
  return {
    title: 'Scope, goals and risks',
    facts: [
      { value: LEVELS[c.complexity], name: 'Complexity' },
      { value: plural(c.goals.length, 'goal'), name: listText(c.goals) },
      { value: plural(c.risks.length, 'risk'), name: high ? `${high} with high impact` : 'None with high impact' },
    ],
    body: (
      <>
        <p className="text-body">{c.summary}</p>
        <Block title="In scope">
          <p className="text-body text-ink-muted">{c.in_scope.join(', ')}.</p>
        </Block>
        {c.out_of_scope.length > 0 && (
          <Block title="Out of scope">
            <p className="text-body text-ink-muted">{c.out_of_scope.join(', ')}.</p>
          </Block>
        )}
        <Block title="Risks">
          <Rows>
            {c.risks.map((r) => (
              <Row key={r.description} title={r.description} detail={r.mitigation} aside={<Pill hue={PRIORITY_HUE[r.impact]} icon={Flag02Icon}>{LEVELS[r.impact]}</Pill>} />
            ))}
          </Rows>
        </Block>
        {c.team_gaps.length > 0 && (
          <Block title="What the team is missing">
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
    title: continuous ? 'Kanban, continuous flow' : `${METHODOLOGY_NAMES[c.methodology]}, ${c.sprint_length_weeks}-week iterations`,
    facts: [
      { value: continuous ? 'Continuous' : plural(c.sprint_length_weeks, 'week'), name: 'Iteration' },
      { value: plural(c.ceremonies.length, 'ceremony', 'ceremonies'), name: listText(c.ceremonies.map((x) => x.name)) },
      ...(wip ? [{ value: `${wip.limit} in progress`, name: 'WIP limit' }] : []),
    ],
    body: (
      <>
        <Block title="Ceremonies">
          <Rows>
            {c.ceremonies.map((x) => <Row key={x.name} title={x.name} detail={`${x.frequency}. ${x.purpose}.`} />)}
          </Rows>
        </Block>
        {c.alternatives.length > 0 && (
          <Block title="Discarded">
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
      { value: plural(c.components.length, 'component'), name: listText(c.components.map((x) => x.name)) },
      { value: plural(c.stack.length, 'layer'), name: listText(c.stack.map((x) => x.technology)) },
      { value: plural(c.decisions.length, 'decision'), name: listText(c.decisions.map((x) => x.title)) },
    ],
    body: (
      <>
        <p className="text-body">{c.summary}</p>
        <Block title="Components">
          <Rows>
            {c.components.map((x) => <Row key={x.name} title={x.name} detail={x.responsibility} aside={<span className="text-caption text-ink-muted">{x.technology}</span>} />)}
          </Rows>
        </Block>
        <Block title="Decisions">
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
    title: `${plural(c.phases.length, 'phase')} in ${plural(weeks, 'week')}`,
    facts: [
      { value: plural(c.phases.length, 'phase'), name: listText(c.phases.map((p) => p.name)) },
      { value: plural(weeks, 'week'), name: 'From start to finish' },
      { value: plural(epics.length, 'epic'), name: listText(epics.map((e) => e.title)) },
    ],
    body: (
      <Block title="Phases">
        <Rows>
          {c.phases.map((p) => (
            <Row
              key={p.name}
              title={p.name}
              detail={`${p.goal}. ${p.epics.map((e) => `${e.key} ${e.title}`).join(', ')}.`}
              aside={<span className="text-caption whitespace-nowrap text-ink-muted tabular-nums">{p.start_week === p.end_week ? `Week ${p.start_week}` : `Weeks ${p.start_week} to ${p.end_week}`}</span>}
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
    title: `${plural(c.stories.length, 'story', 'stories')} in ${plural(epics.length, 'epic')}`,
    facts: [
      { value: plural(c.stories.length, 'story', 'stories'), name: `${c.stories.filter((s) => s.priority === 'high').length} with high priority` },
      { value: points(total), name: 'Estimated' },
      { value: plural(epics.length, 'epic'), name: listText(epics) },
    ],
    body: (
      <Block title="Stories">
        <ShortList
          items={c.stories}
          noun="stories"
          render={(s) => (
            <Row
              key={s.key}
              title={<span className="flex gap-2"><span className="text-key text-ink-muted">{s.key}</span>{s.title}</span>}
              detail={`${s.epic_key}, ${s.role}`}
              aside={
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-key text-ink-muted">{points(s.points)}</span>
                  <StateLabel hue={PRIORITY_HUE[s.priority]} icon={Flag02Icon} className="w-20">{LEVELS[s.priority]}</StateLabel>
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
      { value: plural(Math.max(0, ...sizes), 'story', 'stories'), name: 'In the fullest sprint' },
      { value: plural(sizes.reduce((a, b) => a + b, 0), 'story', 'stories'), name: 'Across all sprints' },
    ],
    body: (
      <Block title="Sprints">
        <Rows>
          {c.sprints.map((s) => <Row key={s.number} title={s.name} detail={`${s.goal}. ${s.story_keys.join(', ')}.`} aside={<span className="text-caption text-ink-muted">{s.phase}</span>} />)}
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
