import type { Methodology } from '../../../domain/plan'
import { ceremonyStep, orderCeremonies, type MethodologyView as View } from '../../../domain/planViews'
import { Block, Card, Flow, Pill, Row, Rows, Slots, type IconGlyph } from '@agile/ui'
import { Calendar03Icon, CheckListIcon, Clock01Icon, RefreshIcon, RepeatIcon, Target02Icon } from '@agile/ui/icons'
import { STATUS_LABELS } from '../board/boardLabels'
import { METHODOLOGY_NAMES } from '../planning/stageBodies'
import { plural, sentence } from '../../format'

// One icon per step of the iteration (ceremonyStep): planning, daily, review, retro, other.
const STEP_ICONS: IconGlyph[] = [Target02Icon, Clock01Icon, CheckListIcon, RefreshIcon, Calendar03Icon]

const BOARD_FLOW = ['todo', 'in_progress', 'review', 'done'] as const

/** How the team works, drawn as two flows: the iteration and the board (spec 012). */
export function MethodologyView({ view }: { view: View }) {
  const { decision } = view
  const continuous = decision.methodology === 'kanban'
  const weeks = decision.sprint_length_weeks
  const limit = (column: string) => decision.wip_limits.find((w) => w.column === column)?.limit ?? null

  return (
    <Card as="article" padding="lg" className="grid gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-heading">
            {continuous ? 'Flujo continuo, sin etapas' : `Por etapas de ${plural(weeks, 'semana')}`}
          </h2>
          <p className="text-body text-ink-muted">{decision.rationale}</p>
        </div>
        {/* Spec 019: no methodology is chosen any more, every project runs by stages. */}
        <Pill hue="neutral" icon={Calendar03Icon}>Trabajo por etapas</Pill>
      </header>

      <Block title={continuous ? 'El ritmo del equipo' : 'Cada etapa'}>
        <Flow
          label="Reuniones de seguimiento en orden"
          steps={[
            ...orderCeremonies(decision.ceremonies).map((c) => ({
              key: c.name,
              title: c.name,
              icon: STEP_ICONS[ceremonyStep(c.name)],
              caption: c.frequency,
              detail: sentence(c.purpose),
            })),
            {
              key: 'repeat',
              title: continuous ? 'Flujo continuo, sin etapas' : `Se repite cada ${weeks === 1 ? 'semana' : plural(weeks, 'semana')}`,
              icon: RepeatIcon,
            },
          ]}
        />
      </Block>

      <Block title="Las actividades">
        <Flow
          label="Columnas de las actividades con su límite"
          steps={BOARD_FLOW.map((column) => ({
            key: column,
            title: STATUS_LABELS[column],
            caption: <Slots limit={column === 'done' ? null : limit(column)} className="mt-1" />,
          }))}
        />
      </Block>

      {decision.alternatives.length > 0 && (
        <Block title="Otras formas de trabajo">
          <Rows>
            {decision.alternatives.map((a) => <Row key={a.methodology} title={METHODOLOGY_NAMES[a.methodology as Methodology] ?? a.methodology} detail={a.why_not} />)}
          </Rows>
        </Block>
      )}
    </Card>
  )
}
