import type { StageStep } from '../../../domain/stepper'
import { Button, Card, Icon, Skeleton, StateLabel } from '../ds'
import { AiMagicIcon, Alert02Icon, PlayIcon, RefreshIcon } from '../ds/icons'
import { STAGE_LABELS } from './stageLabels'

function AgentHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-soft text-violet">
        <Icon icon={AiMagicIcon} />
      </span>
      <div className="grid min-w-0">
        <h2 className="text-heading">{title}</h2>
        <span className="text-caption text-ink-muted">{caption}</span>
      </div>
    </div>
  )
}

/** The agent is on it: no actions, the proposal arrives by itself. */
export function WorkingCard({ step }: { step: StageStep }) {
  const label = STAGE_LABELS[step.key]
  return (
    <Card as="article" padding="lg" className="grid gap-5" aria-busy="true">
      <AgentHeading title={`Trabajando en ${label.the}`} caption={label.agent} />
      <p className="text-body text-ink-muted">La propuesta aparece aquí en unos segundos. Puedes salir de esta pantalla, el agente sigue trabajando.</p>
      <div className="grid gap-3" aria-hidden="true">
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
        </div>
      </div>
    </Card>
  )
}

export function FailedCard({ step, onRetry, retrying }: { step: StageStep; onRetry: () => void; retrying: boolean }) {
  const label = STAGE_LABELS[step.key]
  return (
    <Card as="article" padding="lg" className="grid gap-5">
      <AgentHeading title={`La etapa de ${label.name.toLowerCase()} falló`} caption={label.agent} />
      <div className="grid gap-1 rounded-md bg-coral-soft p-4">
        <StateLabel hue="coral" icon={Alert02Icon}>Falló</StateLabel>
        <p className="text-body text-ink">{step.reason ?? 'El agente no pudo terminar esta etapa.'}</p>
      </div>
      <div>
        <Button variant="primary" icon={RefreshIcon} loading={retrying} onClick={onRetry}>Reintentar</Button>
      </div>
    </Card>
  )
}

export function NotStartedCard({ step, previous, onStart, starting }: { step: StageStep; previous?: StageStep; onStart?: () => void; starting: boolean }) {
  const label = STAGE_LABELS[step.key]
  return (
    <Card as="article" padding="lg" className="grid gap-5">
      <AgentHeading title={label.name} caption={label.agent} />
      <p className="text-body text-ink-muted">
        {onStart
          ? 'Los agentes todavía no empezaron. Cada etapa espera tu aprobación antes de pasar a la siguiente.'
          : `Empieza cuando apruebes ${previous ? STAGE_LABELS[previous.key].the : 'la etapa anterior'}.`}
      </p>
      {onStart && (
        <div>
          <Button variant="primary" icon={PlayIcon} loading={starting} onClick={onStart}>Empezar a planificar</Button>
        </div>
      )}
    </Card>
  )
}
