import type { ProjectGateway } from '../../application/ports'
import type { Member, MemberInput, Project, ProjectSummary } from '../../domain/project'
import { canChangeMethodology, validateMembers, validateProjectCreate } from '../../domain/project'
import { demoPlanViews } from './demoData'
import { type FakeStore, fail, invalid, notFound, reply } from './store'

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ')

function toMember(store: FakeStore, input: MemberInput, current?: Member): Member {
  return {
    id: current?.id ?? store.id(),
    name: tidy(input.name ?? current?.name ?? ''),
    role: tidy(input.role ?? current?.role ?? ''),
    seniority: input.seniority ?? current?.seniority ?? 'mid',
    hours_per_week: input.hours_per_week ?? current?.hours_per_week ?? 20,
    skills: [...new Set((input.skills ?? current?.skills ?? []).map(tidy).filter(Boolean))],
  }
}

export function fakeProjectGateway(store: FakeStore): ProjectGateway {
  const find = (id: number) => store.projects.get(id) ?? notFound('project', id)

  return {
    async create(body) {
      const issues = validateProjectCreate(body)
      if (issues.length) invalid(issues, 'The project has invalid fields.')
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
        members: body.members.map((m) => toMember(store, m)),
        created_at: store.now(),
      }
      store.projects.set(project.id, project)
      return reply(project)
    },

    async list() {
      const summaries: ProjectSummary[] = [...store.projects.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
        .map((p) => ({ id: p.id, name: p.name, status: p.status, duration_weeks: p.duration_weeks, member_count: p.members.length, created_at: p.created_at }))
      return reply(summaries)
    },

    async get(id) {
      return reply(find(id))
    },

    async update(id, body) {
      const project = find(id)
      if (Object.keys(body).length === 0) invalid([{ field: '', message: 'No fields to update.' }])
      let members = project.members
      if (body.members) {
        const unknown = body.members.findIndex((m) => m.id !== undefined && !project.members.some((x) => x.id === m.id))
        if (unknown >= 0) invalid([{ field: `members[${unknown}].id`, message: 'Unknown member.' }])
        const issues = validateMembers(body.members.map((m) => toMember(store, m, project.members.find((x) => x.id === m.id))))
        if (issues.length) invalid(issues, 'The project has invalid fields.')
        members = body.members.map((m) => toMember(store, m, project.members.find((x) => x.id === m.id)))
      }
      if (body.requested_methodology && body.requested_methodology !== project.requested_methodology && !canChangeMethodology(project)) {
        fail(409, { code: 'methodology_locked', detail: "The methodology can't change once planning has started." })
      }
      const before = project.members
      const edited: Project = { ...project, ...body, members }
      store.projects.set(id, edited)

      const joined = members.filter((m) => !before.some((b) => b.id === m.id)).map((m) => m.name)
      const left = before.filter((b) => !members.some((m) => m.id === b.id)).map((m) => m.name)
      const changed = members.flatMap((m) => {
        const old = before.find((b) => b.id === m.id)
        if (!old) return []
        const fields = (['name', 'role', 'seniority', 'hours_per_week', 'skills'] as const).filter((f) => JSON.stringify(old[f]) !== JSON.stringify(m[f]))
        return fields.length ? [{ member_id: m.id, name: m.name, fields: [...fields] }] : []
      })
      if (joined.length || left.length || changed.length) {
        store.publish({ type: 'team_changed', project_id: id, actor: 'person', summary: 'Team changed', ref: { kind: 'project', id }, joined, left, changed })
      }
      return reply(edited)
    },

    async getPlanViews(id) {
      const project = find(id)
      return reply(demoPlanViews(project, [...store.proposals.values()].filter((p) => p.project_id === id)))
    },
  }
}
