import { useState } from 'react'
import { useProposalActions } from '../../../application/use-cases/usePlanning'
import { useCanManage } from '../../../application/use-cases/useSession'
import type { StageKey } from '../../../domain/plan'
import { finalContent, type Proposal } from '../../../domain/proposals'
import type { FieldErrors } from '../../../domain/rules'
import type { StageState } from '../../../domain/stepper'
import { Button, Card, Icon, Pill, StateLabel } from '../ds'
import { AiMagicIcon, Alert02Icon, Edit02Icon, HourglassIcon, InformationCircleIcon, RefreshIcon, Tick02Icon, UserWarning01Icon } from '../ds/icons'
import { AdjustEditor, validateAdjust } from './AdjustEditor'
import { RejectDialog } from './RejectDialog'
import { summarizeStage } from './stageBodies'
import { STAGE_LABELS } from './stageLabels'
import { proposalLook } from './stageStates'

interface ProposalCardProps {
  projectId: number
  stageKey: StageKey
  state: StageState
  proposal: Proposal
  /** Decided, and the next step hasn't started yet. */
  applying: boolean
  onRetryStage: () => void
  retryingStage: boolean
}

/** What the agent decided, why, the main facts, and the leader's decision. Members see it without the decision buttons. */
export function ProposalCard({ projectId, stageKey, state, proposal, applying, onRetryStage, retryingStage }: ProposalCardProps) {
  const { approve, adjust, reject, retryApply } = useProposalActions(projectId)
  const manage = useCanManage(projectId)
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const content = draft ?? finalContent(proposal)
  const summary = summarizeStage(stageKey, finalContent(proposal))
  const look = proposalLook(proposal, applying)
  const waiting = proposal.status === 'pending'
  const needsLeader = state === 'needs_leader'
  const label = STAGE_LABELS[stageKey]

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
    <Card as="article" padding="lg" className="grid gap-5" aria-label={`Propuesta: ${label.name}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-soft text-violet">
            <Icon icon={AiMagicIcon} />
          </span>
          <div className="grid min-w-0">
            <h2 className="text-heading">{summary.title}</h2>
            <span className="text-caption text-ink-muted">{label.agent}</span>
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
          <StateLabel hue="amber" icon={UserWarning01Icon}>{manage ? 'Te necesita' : 'Necesita al líder'}</StateLabel>
          <p className="text-body text-ink">
            {manage
              ? 'La rechazaste tres veces seguidas. Reinténtala con tu último motivo o ajusta esta propuesta tú mismo.'
              : 'Se rechazó tres veces seguidas. Un líder la reintenta o la ajusta.'}
          </p>
        </div>
      )}

      {proposal.status === 'rejected' && proposal.rejection_reason && (
        <div className="grid gap-1 rounded-md bg-inset p-4">
          <span className="text-label">{manage ? 'Tu motivo' : 'El motivo del líder'}</span>
          <p className="text-body text-ink-muted">{proposal.rejection_reason}</p>
        </div>
      )}

      {proposal.apply_failed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-coral-soft p-4">
          <StateLabel hue="coral" icon={Alert02Icon}>{proposal.apply_error ?? 'Se aprobó, pero no se pudo aplicar.'}</StateLabel>
          {manage && <Button size="sm" variant="primary" icon={RefreshIcon} loading={retryApply.isPending} onClick={() => retryApply.mutate(proposal.id)}>Reintentar</Button>}
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
          <Button variant="primary" icon={Tick02Icon} loading={saving} onClick={saveAdjusted}>Aprobar con cambios</Button>
          <Button variant="quiet" onClick={() => { setDraft(null); setErrors({}) }}>Cancelar</Button>
        </div>
      ) : !manage ? (
        waiting && <StateLabel hue="amber" icon={HourglassIcon}>Esperando la aprobación del líder</StateLabel>
      ) : waiting ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={Tick02Icon} loading={approve.isPending} onClick={() => approve.mutate(proposal.id)}>Aprobar</Button>
          <Button icon={Edit02Icon} onClick={() => setDraft(structuredClone(finalContent(proposal)))}>Ajustar</Button>
          <Button variant="quiet" onClick={() => setRejecting(true)}>Rechazar</Button>
        </div>
      ) : needsLeader ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={RefreshIcon} loading={retryingStage} onClick={onRetryStage}>Reintentar {label.the}</Button>
          <Button icon={Edit02Icon} onClick={() => setDraft(structuredClone(proposal.content))}>Ajustarla tú mismo</Button>
        </div>
      ) : null}

      {rejecting && <RejectDialog what={label.the} onReject={(reason) => reject(proposal.id, reason)} onClose={() => setRejecting(false)} />}
    </Card>
  )
}
