import type { ProjectGateway } from '../../application/ports'
import type { Project, ProjectSummary } from '../../domain/project'
import { canChangeMethodology, validateProjectCreate } from '../../domain/project'
import { buildPlanViews } from './planViews'
import { type FakeStore, fail, invalid, notFound, reply } from './store'

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ')

/** The access checks (session, membership, leader) run first, in access.ts. */
export function fakeProjectGateway(store: FakeStore): ProjectGateway {
  const find = (id: number) => store.projects.get(id) ?? notFound('project', id)

  return {
    async create(body) {
      const account = store.signedIn()
      const issues = validateProjectCreate(body)
      // The creator's role here: the one given, else the profile's; a member always has one (spec 015, FR-006).
      const role = tidy(body.role ?? '') || account.role
      if (!role && !issues.some((i) => i.field === 'role')) issues.push({ field: 'role', message: 'Required.' })
      if (issues.length) invalid(issues, 'El proyecto tiene campos con errores.')
      const project: Project = {
        id: store.id(),
        name: tidy(body.name),
        description: body.description.trim(),
        duration_weeks: body.duration_weeks ?? 8,
        requested_methodology: body.requested_methodology ?? 'auto',
        status: 'draft',
        auto_approve: body.auto_approve ?? false,
        repository: null,
        plan: null,
        members: [{
          id: store.id(), name: account.name, role: role!, seniority: account.seniority, hours_per_week: account.hours_per_week,
          skills: [...account.skills], github_username: account.github_username, avatar_url: account.avatar_url, account_id: account.id, permission: 'leader',
        }],
        created_at: store.now(),
      }
      store.projects.set(project.id, project)
      store.invitations.set(project.id, store.token())
      return reply(project)
    },

    async list() {
      const account = store.signedIn()
      const summaries: ProjectSummary[] = [...store.projects.values()]
        .flatMap((p) => {
          const mine = p.members.find((m) => m.account_id === account.id)
          return mine ? [{ id: p.id, name: p.name, status: p.status, duration_weeks: p.duration_weeks, member_count: p.members.length, created_at: p.created_at, permission: mine.permission }] : []
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      return reply(summaries)
    },

    async get(id) {
      return reply(find(id))
    },

    async update(id, body) {
      const project = find(id)
      if (Object.keys(body).length === 0) invalid([{ field: '', message: 'No fields to update.' }])
      if (body.requested_methodology && body.requested_methodology !== project.requested_methodology && !canChangeMethodology(project)) {
        fail(409, { code: 'methodology_locked', detail: 'La metodología no se puede cambiar una vez que empezó la planificación.' })
      }
      // The team isn't edited here any more (spec 015): an old client's `members` is ignored, like the service does.
      const { members: _ignored, ...fields } = body as typeof body & { members?: unknown }
      const edited: Project = { ...project, ...fields }
      store.projects.set(id, edited)
      return reply(edited)
    },

    async getPlanViews(id) {
      const project = find(id)
      return reply(buildPlanViews(project, [...store.proposals.values()].filter((p) => p.project_id === id), store.boards.get(id)?.tasks ?? []))
    },
  }
}
