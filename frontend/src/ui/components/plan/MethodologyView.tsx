import type { Methodology } from '../../../domain/plan'
import { ceremonyStep, orderCeremonies, type MethodologyView as View } from '../../../domain/planViews'
import { Block, Card, Flow, Pill, Row, Rows, Slots, type IconGlyph } from '../ds'
import { AiMagicIcon, Calendar03Icon, CheckListIcon, Clock01Icon, RefreshIcon, RepeatIcon, Target02Icon, UserIcon } from '../ds/icons'
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
            {continuous ? 'Kanban, flujo continuo' : `${METHODOLOGY_NAMES[decision.methodology]}, iteraciones de ${plural(weeks, 'semana')}`}
          </h2>
          <p className="text-body text-ink-muted">{decision.rationale}</p>
        </div>
        {view.chosen_by === 'leader'
          ? <Pill hue="neutral" icon={UserIcon}>Elegida por ti</Pill>
          : <Pill hue="violet" icon={AiMagicIcon}>Elegida por los agentes</Pill>}
      </header>

      <Block title={continuous ? 'El ritmo del equipo' : 'Cada iteración'}>
        <Flow
          label="Ceremonias en orden"
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
              title: continuous ? 'Flujo continuo, sin iteraciones' : `Se repite cada ${weeks === 1 ? 'semana' : plural(weeks, 'semana')}`,
              icon: RepeatIcon,
            },
          ]}
        />
      </Block>

      <Block title="El tablero">
        <Flow
          label="Columnas del tablero con su límite"
          steps={BOARD_FLOW.map((column) => ({
            key: column,
            title: STATUS_LABELS[column],
            caption: <Slots limit={column === 'done' ? null : limit(column)} className="mt-1" />,
          }))}
        />
      </Block>

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
