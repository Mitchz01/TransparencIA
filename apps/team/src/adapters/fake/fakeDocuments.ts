// Documents in the fake store (spec 006): a document proposal's key says which document it creates or updates.
// general_spec | epic_spec:<EP-n> | flow_diagram:<n>

import type { DocumentKind } from '../../domain/documents'
import type { EpicSpecContent, FlowDiagramContent, GeneralSpecContent } from '../../domain/proposalContent'
import { finalContent, type Proposal } from '../../domain/proposals'
import type { FakeStore, StoredDocument } from './store'

type DocumentContent = GeneralSpecContent | EpicSpecContent | FlowDiagramContent

export const SPEC_WRITER = 'Spec writer'

export function kindOfKey(key: string): DocumentKind {
  if (key.startsWith('epic_spec:')) return 'epic_spec'
  if (key.startsWith('flow_diagram:')) return 'flow_diagram'
  return 'general_spec'
}

const textOf = (content: DocumentContent) => ('mermaid' in content ? content.mermaid : content.markdown)

/** Creates the document, or adds a version to the one with the same key. */
export function applyDocument(store: FakeStore, projectId: number, key: string, content: DocumentContent, proposalId: number | null, at = store.now()): StoredDocument {
  const existing = [...store.documents.values()].find((d) => d.project_id === projectId && d.key === key)
  if (existing) {
    const version = existing.version + 1
    const updated: StoredDocument = {
      ...existing, version, title: content.title, outdated: false, updated_at: at,
      contents: { ...existing.contents, [version]: textOf(content) },
      versions: [...existing.versions, { version, created_at: at, source: 'agent', proposal_id: proposalId }],
    }
    store.documents.set(updated.id, updated)
    return updated
  }
  const id = store.id()
  const created: StoredDocument = {
    id, key, project_id: projectId, kind: kindOfKey(key), epic_key: key.startsWith('epic_spec:') ? key.slice('epic_spec:'.length) : null,
    title: content.title, version: 1, outdated: false, updated_at: at, contents: { 1: textOf(content) },
    versions: [{ version: 1, created_at: at, source: 'agent', proposal_id: proposalId }],
  }
  store.documents.set(id, created)
  return created
}

export const applyDocumentProposal = (store: FakeStore, proposal: Proposal) =>
  applyDocument(store, proposal.project_id, proposal.key, finalContent(proposal) as unknown as DocumentContent, proposal.id)

/** A pending `document` proposal, announced like the backend does. */
export function documentProposal(store: FakeStore, projectId: number, key: string, content: DocumentContent, rationale: string, summary: string): Proposal {
  const proposal: Proposal = {
    id: store.id(), project_id: projectId, kind: 'document', key, agent: SPEC_WRITER,
    content: content as unknown as Record<string, unknown>, rationale, status: 'pending', adjusted_content: null,
    rejection_reason: null, auto_approved: false, origin: 'leader', apply_failed: false, apply_error: null,
    created_at: store.now(), resolved_at: null,
  }
  store.proposals.set(proposal.id, proposal)
  store.publish({
    type: 'proposal_created', project_id: projectId, actor: 'agent', ref: { kind: 'proposal', id: proposal.id },
    summary, proposal_id: proposal.id, kind: 'document', key, agent: SPEC_WRITER,
  })
  return proposal
}

/** The regenerated text: the current one with the leader's instructions applied (as far as a fake can). */
export function regenerated(doc: StoredDocument, instructions: string): DocumentContent {
  const current = doc.contents[doc.version]
  if (doc.kind === 'flow_diagram') {
    return { title: doc.title, kind: 'flow', mermaid: `${current}\n  E --> F[${instructions.replace(/[[\]{}()"]/g, '').slice(0, 60)}]` }
  }
  const markdown = `${current}\n\n## Cambios pedidos\n\n- ${instructions}`
  return doc.kind === 'epic_spec'
    ? { epic_key: doc.epic_key!, title: doc.title, markdown, rationale: `Regenerada con tus instrucciones: ${instructions}` }
    : { title: doc.title, markdown, rationale: `Regenerada con tus instrucciones: ${instructions}` }
}
