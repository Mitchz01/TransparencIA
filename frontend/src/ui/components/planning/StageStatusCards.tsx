import type { StageStep } from '../../../domain/stepper'
import { Button, Card, Icon, Skeleton, StateLabel } from '../ds'
import { AiMagicIcon, Alert02Icon, PlayIcon, RefreshIcon } from '../ds/icons'

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
  return (
    <Card as="article" padding="lg" className="grid gap-5" aria-busy="true">
      <AgentHeading title={`Working on the ${step.name.toLowerCase()}`} caption={step.agent} />
      <p className="text-body text-ink-muted">The proposal shows up here in a few seconds. You can leave this screen, the agent keeps going.</p>
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
  return (
    <Card as="article" padding="lg" className="grid gap-5">
      <AgentHeading title={`The ${step.name.toLowerCase()} failed`} caption={step.agent} />
      <div className="grid gap-1 rounded-md bg-coral-soft p-4">
        <StateLabel hue="coral" icon={Alert02Icon}>Failed</StateLabel>
        <p className="text-body text-ink">{step.reason ?? 'The agent couldn’t finish this stage.'}</p>
      </div>
      <div>
        <Button variant="primary" icon={RefreshIcon} loading={retrying} onClick={onRetry}>Retry</Button>
      </div>
    </Card>
  )
}

export function NotStartedCard({ step, previous, onStart, starting }: { step: StageStep; previous?: StageStep; onStart?: () => void; starting: boolean }) {
  return (
    <Card as="article" padding="lg" className="grid gap-5">
      <AgentHeading title={step.name} caption={step.agent} />
      <p className="text-body text-ink-muted">
        {onStart
          ? 'The agents haven’t started yet. Each stage waits for your approval before the next one begins.'
          : `It starts when the ${previous?.name.toLowerCase() ?? 'previous stage'} is approved.`}
      </p>
      {onStart && (
        <div>
          <Button variant="primary" icon={PlayIcon} loading={starting} onClick={onStart}>Start planning</Button>
        </div>
      )}
    </Card>
  )
}
