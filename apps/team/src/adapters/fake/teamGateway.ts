import type { TeamGateway } from '../../application/ports'
import { isLastLeader, uniqueName, validateMemberUpdate } from '../../domain/account'
import type { Member } from '../../domain/project'
import { authorize } from './access'
import { type FakeStore, fail, invalid, notFound, online, reply } from './store'

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ')
const DATA_FIELDS = ['name', 'role', 'seniority', 'hours_per_week', 'skills'] as const

const lastLeader = () => fail(409, { code: 'last_leader', detail: 'The project needs a leader. Make someone else leader first.' })

/** Saves a project's new team and publishes team_changed when anything but permissions changed (spec 001, FR-010). */
export function saveTeam(store: FakeStore, projectId: number, members: Member[]): void {
  const project = store.projects.get(projectId)!
  const before = project.members
  store.projects.set(projectId, { ...project, members })

  const joined = members.filter((m) => !before.some((b) => b.id === m.id)).map((m) => m.name)
  const left = before.filter((b) => !members.some((m) => m.id === b.id)).map((m) => m.name)
  const changed = members.flatMap((m) => {
    const old = before.find((b) => b.id === m.id)
    const fields = old ? DATA_FIELDS.filter((f) => JSON.stringify(old[f]) !== JSON.stringify(m[f])) : []
    return fields.length ? [{ member_id: m.id, name: m.name, fields: [...fields] }] : []
  })
  if (!joined.length && !left.length && !changed.length) return
  const summary = joined.length ? `${joined.join(', ')} se unió al equipo` : left.length ? `${left.join(', ')} dejó el equipo` : 'Cambió el equipo'
  store.publish({ type: 'team_changed', project_id: projectId, actor: 'person', summary, ref: { kind: 'project', id: projectId }, joined, left, changed })
}

/** Leaving or being removed unassigns your pending tasks; done ones keep your name (spec 015, FR-014). */
function unassignPending(store: FakeStore, projectId: number, memberId: number): void {
  const board = store.boards.get(projectId)
  if (!board) return
  board.tasks = board.tasks.map((t) => (t.assignee_id === memberId && t.status !== 'done' ? { ...t, assignee_id: null } : t))
}

export function fakeTeamGateway(store: FakeStore): TeamGateway {
  const projectOf = (id: number) => store.projects.get(id) ?? notFound('project', id)
  const memberOf = (projectId: number, memberId: number) => projectOf(projectId).members.find((m) => m.id === memberId) ?? notFound('member', memberId)
  const tokenOf = (token: string) => {
    const entry = [...store.invitations.entries()].find(([, t]) => t !== null && t === token)
    return entry ? projectOf(entry[0]) : fail(404, { code: 'invitation_not_found', detail: 'This invitation isn’t valid anymore. Ask the leader for a new link.' })
  }

  return {
    async updateMember(projectId, memberId, body) {
      await online()
      const project = projectOf(projectId)
      const current = memberOf(projectId, memberId)
      if (Object.keys(body).length === 0) invalid([{ field: '', message: 'No fields to update.' }])
      const issues = validateMemberUpdate(body)
      if (issues.length) invalid(issues, 'El miembro tiene campos con errores.')
      const name = body.name === undefined ? current.name : tidy(body.name)
      if (project.members.some((m) => m.id !== memberId && m.name.toLowerCase() === name.toLowerCase())) {
        invalid([{ field: 'name', message: 'Ese nombre ya está en el equipo.' }])
      }
      if (body.permission === 'member' && current.permission === 'leader' && isLastLeader(project, memberId)) lastLeader()
      const edited: Member = {
        ...current,
        ...body,
        name,
        role: body.role === undefined ? current.role : tidy(body.role),
        skills: body.skills ? [...new Set(body.skills.map(tidy).filter(Boolean))] : current.skills,
      }
      saveTeam(store, projectId, project.members.map((m) => (m.id === memberId ? edited : m)))
      return reply(store.projects.get(projectId)!)
    },

    async removeMember(projectId, memberId) {
      await online()
      const me = authorize(store, projectId, 'view')
      const project = projectOf(projectId)
      memberOf(projectId, memberId)
      if (me.permission !== 'leader' && me.id !== memberId) fail(403, { code: 'forbidden', detail: 'Only the project’s leaders can do this.' })
      if (isLastLeader(project, memberId)) lastLeader()
      unassignPending(store, projectId, memberId)
      saveTeam(store, projectId, project.members.filter((m) => m.id !== memberId))
      return reply(undefined)
    },

    async getInvitation(projectId) {
      const token = store.invitations.get(projectId) ?? null
      return reply({ active: token !== null, token })
    },

    async renewInvitation(projectId) {
      await online()
      const token = store.token()
      store.invitations.set(projectId, token)
      return reply({ active: true, token })
    },

    async disableInvitation(projectId) {
      await online()
      store.invitations.set(projectId, null)
      return reply(undefined)
    },

    async previewInvitation(token) {
      const project = tokenOf(token)
      return reply({
        project_name: project.name,
        leaders: project.members.filter((m) => m.permission === 'leader').map((m) => m.name),
        already_member: store.session !== null && project.members.some((m) => m.account_id === store.session),
      })
    },

    async join(token, body = {}) {
      await online()
      const account = store.signedIn()
      const project = tokenOf(token)
      if (project.members.some((m) => m.account_id === account.id)) return reply({ project_id: project.id, joined: false })
      const role = tidy(body.role ?? '') || account.role
      if (!role) invalid([{ field: 'role', message: 'Required.' }])
      const joined: Member = {
        id: store.id(),
        name: uniqueName(account.name, project.members.map((m) => m.name)),
        role: role!,
        seniority: account.seniority,
        hours_per_week: account.hours_per_week,
        skills: [...account.skills],
        github_username: account.github_username,
        avatar_url: account.avatar_url,
        account_id: account.id,
        permission: 'member',
      }
      saveTeam(store, project.id, [...project.members, joined])
      return reply({ project_id: project.id, joined: true })
    },
  }
}
