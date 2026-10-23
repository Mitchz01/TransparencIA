import type { BulkApproveResult, ProposalGateway } from '../../application/ports'
import type { Proposal } from '../../domain/proposals'
import { BULK_MAX, REASON_MAX, canRetryApply } from '../../domain/proposals'
import { ApiError } from '../../application/errors'
import { isStageKey } from '../../domain/proposalContent'
import { rejectedInARow, stageProposals } from '../../domain/stepper'
import { type FakeStore, fail, invalid, notFound, online, reply } from './store'

const KEYS: Record<string, string> = {
  analysis: 'análisis', methodology: 'metodología', architecture: 'arquitectura', roadmap: 'roadmap',
  backlog: 'backlog', sprints: 'sprints', general_spec: 'spec general', create_issues: 'publicar issues',
}

const VERBS: Record<Proposal['status'], string> = {
  pending: 'Reabriste', approved: 'Aprobaste', adjusted: 'Ajustaste', rejected: 'Rechazaste', discarded: 'Descartaste',
}

export function fakeProposalGateway(store: FakeStore): ProposalGateway {
  const find = (id: number) => store.proposals.get(id) ?? notFound('proposal', id)

  // After three rejections the leader can adjust the newest rejected proposal of the stage (spec 005).
  const adjustableAfterRejections = (proposal: Proposal) =>
    proposal.kind === 'plan_stage' && isStageKey(proposal.key) && proposal.status === 'rejected' &&
    rejectedInARow([...store.proposals.values()].filter((p) => p.project_id === proposal.project_id), proposal.key) &&
    stageProposals([...store.proposals.values()].filter((p) => p.project_id === proposal.project_id), proposal.key)[0]?.id === proposal.id

  function decide(id: number, change: Partial<Proposal>): Proposal {
    const proposal = find(id)
    if (proposal.status !== 'pending' && !(change.status === 'adjusted' && adjustableAfterRejections(proposal))) {
      fail(409, { code: 'proposal_already_resolved', detail: 'Esta propuesta ya se resolvió.', status: proposal.status })
    }
    const resolved: Proposal = { ...proposal, ...change, resolved_at: store.now() }
    store.proposals.set(id, resolved)
    store.publish({
      type: 'proposal_resolved', project_id: resolved.project_id, actor: 'person', ref: { kind: 'proposal', id },
      summary: `${VERBS[resolved.status]} la propuesta de ${KEYS[resolved.key] ?? resolved.key.replace(/_/g, ' ')}`, proposal_id: id, kind: resolved.kind, key: resolved.key,
      status: resolved.status, auto: false, reason: resolved.rejection_reason,
    })
    return resolved
  }

  return {
    async list(projectId, status) {
      if (!store.projects.has(projectId)) notFound('project', projectId)
      const proposals = [...store.proposals.values()]
        .filter((p) => p.project_id === projectId && (!status || p.status === status))
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      return reply(proposals)
    },
    async get(id) {
      return reply(find(id))
    },
    async approve(id) {
      await online()
      return reply(decide(id, { status: 'approved' }))
    },
    async adjust(id, content) {
      await online()
      return reply(decide(id, { status: 'adjusted', adjusted_content: content }))
    },
    async reject(id, reason) {
      await online()
      const clean = reason.trim()
      if (!clean) invalid([{ field: 'reason', message: 'Obligatorio.' }])
      if (clean.length > REASON_MAX) invalid([{ field: 'reason', message: `Máximo ${REASON_MAX} caracteres.` }])
      return reply(decide(id, { status: 'rejected', rejection_reason: clean }))
    },
    async retryApply(id) {
      const proposal = find(id)
      if (!canRetryApply(proposal)) fail(409, { code: 'proposal_not_retryable', detail: 'Esta propuesta no tiene nada que reintentar.' })
      store.proposals.set(id, { ...proposal, apply_failed: false, apply_error: null })
      return reply({ proposal_id: id, status: 'applying' as const })
    },
    async approveMany(projectId, ids) {
      if (!store.projects.has(projectId)) notFound('project', projectId)
      if (ids.length === 0 || ids.length > BULK_MAX) invalid([{ field: 'ids', message: `Between 1 and ${BULK_MAX} ids.` }])
      const results: BulkApproveResult[] = ids.map((id) => {
        try {
          const proposal = store.proposals.get(id)
          if (!proposal || proposal.project_id !== projectId) notFound('proposal', id)
          decide(id, { status: 'approved' })
          return { id, ok: true, error: null }
        } catch (error) {
          return { id, ok: false, error: error instanceof ApiError ? error.body : { code: 'internal_error', detail: 'Unexpected error.' } }
        }
      })
      return reply(results)
    },
  }
}
