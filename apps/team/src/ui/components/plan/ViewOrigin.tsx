import type { StageKey } from '../../../domain/plan'
import type { ViewOrigin as Origin, ViewStatus } from '../../../domain/planViews'
import { formatDate } from '../../format'
import { ButtonLink, Card, EmptyState, Icon, Pill } from '@agile/ui'
import { AiMagicIcon, ArrowRight01Icon, Edit02Icon, HourglassIcon, InformationCircleIcon, Tick02Icon } from '@agile/ui/icons'
import { STAGE_LABELS } from '../planning/stageLabels'

const DECISIONS = {
  leader: { label: 'Aprobado por ti', icon: Tick02Icon },
  adjusted: { label: 'Ajustado por ti', icon: Edit02Icon },
  auto: { label: 'Aprobado automáticamente', icon: AiMagicIcon },
} as const

/** Which agent wrote this part, why, and how and when it was approved (spec 004). */
export function ViewOrigin({ stage, origin }: { stage: StageKey; origin: Origin }) {
  const decision = DECISIONS[origin.decision]
  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-soft text-violet">
            <Icon icon={AiMagicIcon} />
          </span>
          <div className="grid min-w-0">
            <span className="text-label">{STAGE_LABELS[stage].agent}</span>
            <span className="text-caption text-ink-muted">{formatDate(origin.approved_at)}</span>
          </div>
        </div>
        <Pill hue="lime" icon={decision.icon}>{decision.label}</Pill>
      </div>
      <div className="flex gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
        <Icon icon={InformationCircleIcon} className="mt-0.5" />
        <p className="text-body">{origin.rationale}</p>
      </div>
    </Card>
  )
}

/** A part that isn't approved yet: says why and links to where it's decided. Never its content. */
export function ViewNotReady({ projectId, stage, status }: { projectId: number; stage: StageKey; status: Exclude<ViewStatus, 'approved'> }) {
  const label = STAGE_LABELS[stage]
  return status === 'pending' ? (
    <EmptyState
      icon={HourglassIcon}
      title="Espera tu aprobación"
      action={<ButtonLink to={`/projects/${projectId}/planning`} variant="primary" icon={ArrowRight01Icon}>Ver la propuesta</ButtonLink>}
    >
      {`${label.agent} ya propuso ${label.the}. Aparece aquí cuando apruebes la propuesta.`}
    </EmptyState>
  ) : (
    <EmptyState
      icon={AiMagicIcon}
      title="Todavía no se generó"
      action={<ButtonLink to={`/projects/${projectId}/planning`} icon={ArrowRight01Icon}>Ir a la planificación</ButtonLink>}
    >
      {`${label.the[0].toUpperCase()}${label.the.slice(1)} llega cuando la planificación pase por esa etapa.`}
    </EmptyState>
  )
}
