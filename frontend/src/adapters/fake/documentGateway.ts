import type { DocumentGateway } from '../../application/ports'
import { DOCUMENT_LIMITS, type DocumentSummary, type ProjectDocument } from '../../domain/documents'
import { type FakeStore, type StoredDocument, fail, invalid, notFound, online, reply } from './store'

const ORDER = { general_spec: 0, epic_spec: 1, flow_diagram: 2 } as const

const view = (doc: StoredDocument, version = doc.version): ProjectDocument => {
  const { contents, updated_at: _updated, key: _key, ...rest } = doc
  return { ...rest, version, content: contents[version] }
}

export function fakeDocumentGateway(store: FakeStore, onRegenerate: (documentId: number, instructions: string) => void): DocumentGateway {
  const find = (id: number) => store.documents.get(id) ?? notFound('document', id)

  return {
    async list(projectId) {
      if (!store.projects.has(projectId)) notFound('project', projectId)
      const summaries: DocumentSummary[] = [...store.documents.values()]
        .filter((d) => d.project_id === projectId)
        .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.epic_key ?? '').localeCompare(b.epic_key ?? '', undefined, { numeric: true }))
        .map(({ id, kind, epic_key, title, version, outdated, updated_at }) => ({ id, kind, epic_key, title, version, outdated, updated_at }))
      return reply(summaries)
    },

    async get(documentId, version) {
      const doc = find(documentId)
      if (version !== undefined && (!Number.isInteger(version) || version < 1)) invalid([{ field: 'version', message: 'Debe ser un entero positivo.' }])
      if (version !== undefined && !(version in doc.contents)) notFound('version', version)
      return reply(view(doc, version))
    },

    async regenerate(documentId, instructions) {
      await online()
      const doc = find(documentId)
      const clean = instructions.trim()
      if (!clean || clean.length > DOCUMENT_LIMITS.instructions) {
        invalid([{ field: 'instructions', message: `Entre 1 y ${DOCUMENT_LIMITS.instructions} caracteres.` }])
      }
      const pending = [...store.proposals.values()].some((p) => p.kind === 'document' && p.status === 'pending' && p.project_id === doc.project_id && p.key === doc.key)
      if (pending) fail(409, { code: 'regeneration_in_progress', detail: 'Ya se está regenerando este documento.' })
      onRegenerate(documentId, clean)
      return reply({ document_id: documentId, status: 'regenerating' as const })
    },

    async save(documentId, content, baseVersion) {
      await online()
      const doc = find(documentId)
      if (!content.trim() || content.length > DOCUMENT_LIMITS.content) invalid([{ field: 'content', message: 'Entre 1 y 100000 caracteres.' }])
      if (baseVersion !== doc.version) {
        fail(409, { code: 'version_conflict', detail: 'Alguien guardó una versión más nueva.', current_version: doc.version })
      }
      const version = doc.version + 1
      const now = store.now()
      const saved: StoredDocument = {
        ...doc, version, outdated: false, updated_at: now, contents: { ...doc.contents, [version]: content },
        versions: [...doc.versions, { version, created_at: now, source: 'leader', proposal_id: null }],
      }
      store.documents.set(documentId, saved)
      return reply(view(saved))
    },
  }
}
