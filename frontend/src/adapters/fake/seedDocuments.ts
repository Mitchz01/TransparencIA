// Documents of the demo project whose plan is complete: the general spec (edited once by the leader),
// one spec per epic and the flow diagram.

import type { Project } from '../../domain/project'
import { epicSpecs, flowDiagram, generalSpec } from './demoDocuments'
import { applyDocument } from './fakeDocuments'
import type { FakeStore } from './store'

export const boardCreatedAt = '2026-10-09T09:40:00Z'

export function seedDocuments(store: FakeStore, project: Project, at: string) {
  const plan = project.plan ?? {}
  const general = generalSpec(project, plan)
  const doc = applyDocument(store, project.id, 'general_spec', general, null, at)
  // The leader added a note by hand a few days later: version 2, without a proposal.
  const edited = `${general.markdown}\n\n## Notas del líder\n\n- Los pagos se prueban primero con el entorno de pruebas del proveedor.`
  const later = new Date(Date.parse(at) + 3 * 86_400_000).toISOString()
  store.documents.set(doc.id, {
    ...doc, version: 2, updated_at: later, contents: { ...doc.contents, 2: edited },
    versions: [...doc.versions, { version: 2, created_at: later, source: 'leader', proposal_id: null }],
  })
  for (const spec of epicSpecs(plan)) applyDocument(store, project.id, `epic_spec:${spec.epic_key}`, spec, null, at)
  applyDocument(store, project.id, 'flow_diagram:1', flowDiagram(project), null, at)
}
