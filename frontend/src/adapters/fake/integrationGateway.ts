import type { IntegrationGateway } from '../../application/ports'
import { REPOSITORY_PATTERN, type Connection } from '../../domain/integrations'
import { type FakeStore, fail, invalid, notFound, online, reply } from './store'

/** Without a backend nothing reaches GitHub, so every connection is in test mode. */
export function fakeIntegrationGateway(store: FakeStore): IntegrationGateway {
  const projectOf = (id: number) => store.projects.get(id) ?? notFound('project', id)

  return {
    async connect(projectId, { repository, token }) {
      await online()
      const project = projectOf(projectId)
      if (!REPOSITORY_PATTERN.test(repository)) invalid([{ field: 'repository', message: 'Usa el formato dueño/nombre.' }])
      // Demo: a repo name says how GitHub would answer.
      if (/no-existe/i.test(repository)) fail(422, { code: 'repository_not_accessible', detail: 'El repo no existe.', reason: 'not_found' })
      if (/privado/i.test(repository)) fail(422, { code: 'repository_not_accessible', detail: 'El token no ve este repo.', reason: 'forbidden' })
      const previous = store.connections.get(projectId)
      const hasToken = token === undefined ? previous?.has_token ?? false : token !== ''
      const connection: Connection = {
        repository, has_token: hasToken, mode: 'test', webhook_registered: false,
        replaced: previous && previous.repository !== repository ? previous.repository : null,
      }
      store.connections.set(projectId, connection)
      store.projects.set(projectId, { ...project, repository, has_token: hasToken })
      return reply(connection)
    },

    async disconnect(projectId) {
      await online()
      const project = projectOf(projectId)
      if (!store.connections.has(projectId)) fail(409, { code: 'repository_not_connected', detail: 'No hay un repo conectado.' })
      store.connections.delete(projectId)
      store.projects.set(projectId, { ...project, repository: null, has_token: false })
      return reply(undefined)
    },

    async proposeIssues(projectId) {
      await online()
      projectOf(projectId)
      if (!store.connections.has(projectId)) fail(409, { code: 'repository_not_connected', detail: 'Primero conecta un repo.' })
      const pending = [...store.proposals.values()].find((p) => p.project_id === projectId && p.key === 'create_issues' && p.status === 'pending')
      if (pending) fail(409, { code: 'publication_pending', detail: 'Ya hay una publicación esperando tu decisión.', proposal_id: pending.id })
      const tasks = (store.boards.get(projectId)?.tasks ?? []).filter((t) => !t.issue)
      if (tasks.length === 0) fail(409, { code: 'nothing_to_publish', detail: 'Todas las tareas ya tienen su issue.' })
      const id = store.id()
      store.proposals.set(id, {
        id, project_id: projectId, kind: 'github_action', key: 'create_issues', agent: 'GitHub assistant',
        content: { tasks: tasks.map((t) => ({ task_id: t.id, key: t.key, title: t.title })) },
        rationale: 'Todas las tareas que todavía no tienen issue, para que el equipo trabaje desde GitHub.', status: 'pending',
        adjusted_content: null, rejection_reason: null, auto_approved: false, origin: 'leader', apply_failed: false,
        apply_error: null, created_at: store.now(), resolved_at: null,
      })
      store.publish({
        type: 'proposal_created', project_id: projectId, actor: 'agent', ref: { kind: 'proposal', id },
        summary: `El asistente de GitHub propuso publicar ${tasks.length} issues`, proposal_id: id, kind: 'github_action', key: 'create_issues', agent: 'GitHub assistant',
      })
      return reply({ proposal_id: id, task_count: tasks.length })
    },

    async setGithubUsername(memberId, username) {
      await online()
      const project = [...store.projects.values()].find((p) => p.members.some((m) => m.id === memberId)) ?? notFound('member', memberId)
      if (username !== null && !/^[A-Za-z0-9-]{1,39}$/.test(username)) invalid([{ field: 'github_username', message: 'No es un usuario de GitHub válido.' }])
      const members = project.members.map((m) => (m.id === memberId ? { ...m, github_username: username } : m))
      store.projects.set(project.id, { ...project, members })
      return reply({ member: members.find((m) => m.id === memberId)!, has_access: username === null || !store.connections.has(project.id) ? null : !/^x-/.test(username) })
    },
  }
}
