// The fake version of backend/app/domain/plan_views.py: roadmap with progress from the board,
// methodology and architecture, each with where it came from. Pending content is never returned.

import type { Task } from '../../domain/board'
import type { Roadmap } from '../../domain/plan'
import type { PhaseView, PlanViews, Progress, ViewOrigin, ViewStatus } from '../../domain/planViews'
import type { Project } from '../../domain/project'
import { isDecided, type Proposal } from '../../domain/proposals'
import { stageProposals } from '../../domain/stepper'

type ViewStage = 'roadmap' | 'methodology' | 'architecture' | 'sprints'

const zero = (): Progress => ({ tasks: 0, tasks_done: 0, points: 0, points_done: 0 })

function add(progress: Progress, task: Task) {
  const done = task.status === 'done'
  progress.tasks += 1
  progress.points += task.points
  progress.tasks_done += done ? 1 : 0
  progress.points_done += done ? task.points : 0
}

function origin(proposals: Proposal[], stage: ViewStage): ViewOrigin | null {
  const decided = stageProposals(proposals, stage).find((p) => isDecided(p) && p.resolved_at)
  if (!decided) return null
  const decision = decided.auto_approved ? 'auto' : decided.status === 'adjusted' ? 'adjusted' : 'leader'
  return { agent: decided.agent, rationale: decided.rationale, approved_at: decided.resolved_at!, decision }
}

function status(project: Project, proposals: Proposal[], stage: ViewStage): ViewStatus {
  if (project.plan && stage in project.plan) return 'approved'
  return stageProposals(proposals, stage).some((p) => p.status === 'pending') ? 'pending' : 'not_generated'
}

const DAY = 24 * 60 * 60 * 1000

function roadmapView(roadmap: Roadmap, project: Project, proposals: Proposal[], tasks: Task[], today: Date) {
  const byEpic = new Map<string, Progress>()
  const total = zero()
  for (const task of tasks) {
    add(total, task)
    if (!byEpic.has(task.epic_key)) byEpic.set(task.epic_key, zero())
    add(byEpic.get(task.epic_key)!, task)
  }
  const phases: PhaseView[] = roadmap.phases.map((phase) => {
    const epics = phase.epics.map((e) => ({ ...e, progress: byEpic.get(e.key) ?? zero(), has_tasks: byEpic.has(e.key) }))
    const progress = epics.reduce((sum, e) => ({
      tasks: sum.tasks + e.progress.tasks, tasks_done: sum.tasks_done + e.progress.tasks_done,
      points: sum.points + e.progress.points, points_done: sum.points_done + e.progress.points_done,
    }), zero())
    return { ...phase, epics, progress }
  })

  let week: number | null = null
  let phaseName: string | null = null
  let overdue = false
  const start = origin(proposals, 'sprints')
  if (project.status === 'ready' && start) {
    week = Math.max(Math.floor((today.getTime() - new Date(start.approved_at).getTime()) / (7 * DAY)) + 1, 1)
    const lastPlanned = Math.max(0, ...roadmap.phases.map((p) => p.end_week))
    if (lastPlanned && week > lastPlanned) {
      week = lastPlanned
      overdue = true
    }
    phaseName = roadmap.phases.find((p) => p.start_week <= week! && week! <= p.end_week)?.name ?? null
  }
  return { phases, progress: total, current_week: week, current_phase: phaseName, overdue }
}

export function buildPlanViews(project: Project, proposals: Proposal[], tasks: Task[], today = new Date()): PlanViews {
  const plan = project.plan ?? {}
  const view = <T>(stage: ViewStage, content: T | null) => {
    const s = status(project, proposals, stage)
    return s === 'approved' ? { status: s, origin: origin(proposals, stage), content } : { status: s, origin: null, content: null }
  }
  return {
    roadmap: view('roadmap', plan.roadmap ? roadmapView(plan.roadmap, project, proposals, tasks, today) : null),
    methodology: view('methodology', plan.methodology ? { decision: plan.methodology, chosen_by: project.requested_methodology === 'auto' ? 'agents' as const : 'leader' as const } : null),
    architecture: view('architecture', plan.architecture ?? null),
  }
}
