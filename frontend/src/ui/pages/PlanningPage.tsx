import { useState } from 'react'
import { usePlanning } from '../../application/use-cases/usePlanning'
import type { StageKey } from '../../domain/plan'
import { isDecided } from '../../domain/proposals'
import { focusStep, type StageStep } from '../../domain/stepper'
import { Button, ButtonLink, Pill, SkeletonCard } from '../components/ds'
import { AiMagicIcon, ArrowRight01Icon, PlayIcon, RefreshIcon } from '../components/ds/icons'
import { ProposalCard } from '../components/planning/ProposalCard'
import { StageStepper } from '../components/planning/StageStepper'
import { FailedCard, NotStartedCard, WorkingCard } from '../components/planning/StageStatusCards'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

/** A decided stage is "applying" until the next one starts (or, for the last one, until the board exists). */
function isApplying(steps: StageStep[], index: number, status: string): boolean {
  const proposal = steps[index].proposal
  if (!proposal || !isDecided(proposal) || proposal.apply_failed) return false
  const next = steps[index + 1]
  return next ? status === 'planning' && next.state === 'not_started' : status !== 'ready'
}

const DESCRIPTIONS = {
  draft: 'Six agents plan the project one stage at a time. Nothing moves on until you approve it.',
  planning: 'The agents propose, you decide. Nothing reaches the board before you approve it.',
  ready: 'The plan is complete and the board is ready.',
  error: 'A stage failed. Retry it and planning continues from there.',
} as const

export function PlanningPage() {
  const loaded = useCurrentProject()
  const { project = loaded, steps, start, retryStage } = usePlanning(loaded.id)
  const focus = steps ? focusStep(steps) : null
  const [selected, setSelected] = useState<StageKey | null>(null)
  const [followed, setFollowed] = useState(focus?.key)

  // Follow the live progress: when a new stage becomes current, show it.
  if (focus && focus.key !== followed) {
    setFollowed(focus.key)
    setSelected(null)
  }

  const index = steps?.findIndex((s) => s.key === (selected ?? focus?.key)) ?? -1
  const step = steps?.[index]

  const actions = (
    <>
      {project.auto_approve && <Pill hue="violet" icon={AiMagicIcon}>Auto-approve on</Pill>}
      {project.status === 'draft' && <Button variant="primary" icon={PlayIcon} loading={start.isPending} onClick={() => start.mutate()}>Start planning</Button>}
      {project.status === 'error' && <Button variant="primary" icon={RefreshIcon} loading={start.isPending} onClick={() => start.mutate()}>Retry</Button>}
      {project.status === 'ready' && <ButtonLink to={`/projects/${project.id}/board`} variant="primary" icon={ArrowRight01Icon}>Open the board</ButtonLink>}
    </>
  )

  return (
    <>
      <PageHeader title="Planning" description={DESCRIPTIONS[project.status]} actions={actions} />
      {!steps || !step ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={5} />
        </div>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-24">
            <StageStepper steps={steps} selected={step.key} onSelect={setSelected} />
          </div>
          <div aria-live="polite">
            {step.proposal && (step.state === 'approved' || step.state === 'waiting' || step.state === 'needs_leader') ? (
              <ProposalCard
                key={step.proposal.id}
                projectId={project.id}
                stageKey={step.key}
                stageName={step.name}
                state={step.state}
                proposal={step.proposal}
                applying={isApplying(steps, index, project.status)}
                onRetryStage={() => retryStage.mutate(step.key)}
                retryingStage={retryStage.isPending}
              />
            ) : step.state === 'working' ? (
              <WorkingCard step={step} />
            ) : step.state === 'failed' ? (
              <FailedCard step={step} retrying={start.isPending} onRetry={() => start.mutate()} />
            ) : (
              <NotStartedCard
                step={step}
                previous={steps[index - 1]}
                starting={start.isPending}
                onStart={project.status === 'draft' && index === 0 ? () => start.mutate() : undefined}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
