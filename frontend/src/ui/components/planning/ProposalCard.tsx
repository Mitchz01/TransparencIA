import { useState } from 'react'
import { useProposalActions } from '../../../application/use-cases/usePlanning'
import type { StageKey } from '../../../domain/plan'
import { finalContent, type Proposal } from '../../../domain/proposals'
import type { FieldErrors } from '../../../domain/rules'
import type { StageState } from '../../../domain/stepper'
import { Button, Card, Icon, Pill, StateLabel } from '../ds'
import { AiMagicIcon, Alert02Icon, Edit02Icon, InformationCircleIcon, RefreshIcon, Tick02Icon, UserWarning01Icon } from '../ds/icons'
import { AdjustEditor, validateAdjust } from './AdjustEditor'
import { RejectDialog } from './RejectDialog'
import { summarizeStage } from './stageBodies'
import { proposalLook } from './stageStates'

interface ProposalCardProps {
  projectId: number
  stageKey: StageKey
  stageName: string
  state: StageState
  proposal: Proposal
  /** Decided, and the next step hasn't started yet. */
  applying: boolean
  onRetryStage: () => void
  retryingStage: boolean
}

/** What the agent decided, why, the main facts, and the leader's decision. */
export function ProposalCard({ projectId, stageKey, stageName, state, proposal, applying, onRetryStage, retryingStage }: ProposalCardProps) {
  const { approve, adjust, reject, retryApply } = useProposalActions(projectId)
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const content = draft ?? finalContent(proposal)
  const summary = summarizeStage(stageKey, finalContent(proposal))
  const look = proposalLook(proposal, applying)
  const waiting = proposal.status === 'pending'
  const needsLeader = state === 'needs_leader'
  const lower = stageName.toLowerCase()

  const saveAdjusted = async () => {
    const local = validateAdjust(stageKey, content)
    setErrors(local)
    if (Object.keys(local).length) return
    setSaving(true)
    const server = await adjust(proposal.id, content)
    setSaving(false)
    setErrors(server)
    if (!Object.keys(server).length) setDraft(null)
  }

  return (
    <Card as="article" padding="lg" className="grid gap-5" aria-label={`${stageName} proposal`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-soft text-violet">
            <Icon icon={AiMagicIcon} />
          </span>
          <div className="grid min-w-0">
            <h2 className="text-heading">{summary.title}</h2>
            <span className="text-caption text-ink-muted">{proposal.agent}</span>
          </div>
        </div>
        <Pill hue={look.hue} icon={look.icon}>{look.label}</Pill>
      </header>

      <div className="flex gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
        <Icon icon={InformationCircleIcon} className="mt-0.5" />
        <p className="text-body">{proposal.rationale}</p>
      </div>

      {needsLeader && (
        <div className="grid gap-1 rounded-md bg-amber-soft p-4">
          <StateLabel hue="amber" icon={UserWarning01Icon}>Needs you</StateLabel>
          <p className="text-body text-ink">Rejected three times in a row. Retry it with your last reason, or adjust this proposal yourself.</p>
        </div>
      )}

      {proposal.status === 'rejected' && proposal.rejection_reason && (
        <div className="grid gap-1 rounded-md bg-inset p-4">
          <span className="text-label">Your reason</span>
          <p className="text-body text-ink-muted">{proposal.rejection_reason}</p>
        </div>
      )}

      {proposal.apply_failed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-coral-soft p-4">
          <StateLabel hue="coral" icon={Alert02Icon}>{proposal.apply_error ?? 'It was approved, but applying it failed.'}</StateLabel>
          <Button size="sm" variant="primary" icon={RefreshIcon} loading={retryApply.isPending} onClick={() => retryApply.mutate(proposal.id)}>Retry</Button>
        </div>
      )}

      {draft ? (
        <AdjustEditor stageKey={stageKey} content={content} errors={errors} onChange={(next) => { setDraft(next); setErrors({}) }} />
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {summary.facts.slice(0, 3).map((fact) => (
              <div key={fact.name} className="grid content-start gap-0.5 rounded-md bg-inset p-4">
                <dt className="order-2 text-caption text-ink-muted">{fact.name}</dt>
                <dd className="order-1 text-label text-ink tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-5">{summary.body}</div>
        </>
      )}

      {draft ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={Tick02Icon} loading={saving} onClick={saveAdjusted}>Approve with changes</Button>
          <Button variant="quiet" onClick={() => { setDraft(null); setErrors({}) }}>Cancel</Button>
        </div>
      ) : waiting ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={Tick02Icon} loading={approve.isPending} onClick={() => approve.mutate(proposal.id)}>Approve</Button>
          <Button icon={Edit02Icon} onClick={() => setDraft(structuredClone(finalContent(proposal)))}>Adjust</Button>
          <Button variant="quiet" onClick={() => setRejecting(true)}>Reject</Button>
        </div>
      ) : needsLeader ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={RefreshIcon} loading={retryingStage} onClick={onRetryStage}>Retry the {lower}</Button>
          <Button icon={Edit02Icon} onClick={() => setDraft(structuredClone(proposal.content))}>Adjust it yourself</Button>
        </div>
      ) : null}

      {rejecting && <RejectDialog what={`the ${lower}`} onReject={(reason) => reject(proposal.id, reason)} onClose={() => setRejecting(false)} />}
    </Card>
  )
}
