// The shape of Proposal.content by kind and key (apps/team/docs/api-contract.md,
// section 3, "Proposal content by kind"). Sources: plans 002, 006, 007 and 008.

import type { TaskStatus } from './board'
import type { StageKey, StageOutputs, Story } from './plan'
import type { Proposal } from './proposals'

export const STAGE_KEYS: readonly StageKey[] = ['analysis', 'methodology', 'architecture', 'roadmap', 'backlog', 'sprints']

/** Agent name per stage, as the backend's PLANNING_STAGES titles them. */
export const STAGE_AGENTS: Record<StageKey, string> = {
  analysis: 'Product analyst',
  methodology: 'Agile coach',
  architecture: 'Software architect',
  roadmap: 'Product manager',
  backlog: 'Product owner',
  sprints: 'Scrum master',
}

export const STAGE_NAMES: Record<StageKey, string> = {
  analysis: 'Analysis',
  methodology: 'Methodology',
  architecture: 'Architecture',
  roadmap: 'Roadmap',
  backlog: 'Backlog',
  sprints: 'Sprints',
}

export const isStageKey = (key: string): key is StageKey => (STAGE_KEYS as readonly string[]).includes(key)

// ---------- document (spec 006): key general_spec | epic_spec:<EP-n> | flow_diagram:<n> ----------

export interface GeneralSpecContent {
  title: string
  markdown: string
  rationale: string
}

export interface EpicSpecContent extends GeneralSpecContent {
  epic_key: string
}

export interface FlowDiagramContent {
  title: string
  kind: 'flow' | 'architecture'
  mermaid: string
}

// ---------- github_action (spec 007): key create_issues | request_review ----------

export interface CreateIssuesContent {
  tasks: { task_id: number; key: string; title: string }[]
}

export interface ReviewFinding {
  criterion: string
  status: 'met' | 'partial' | 'missing'
  comment: string
}

export interface RequestReviewContent {
  repository: string
  pr_number: number
  reviewers: { member_id: number; username: string; reason: string }[]
  review: {
    summary: string
    findings: ReviewFinding[]
    risks: string[]
    reviewed_fully: boolean
    rationale: string
  }
}

// ---------- replan (spec 008) ----------

export type ReplanChange =
  | { kind: 'move'; task_key: string; to_sprint: number; expected_status: TaskStatus; rationale: string }
  | { kind: 'reassign'; task_key: string; to_member: string; expected_status: TaskStatus; rationale: string }
  | { kind: 'add'; new_story: Story; to_sprint: number; rationale: string }
  | { kind: 'discard'; task_key: string; expected_status: TaskStatus; rationale: string }

export interface ReplanContent {
  changes: ReplanChange[]
  rationale: string
}

// ---------- Accessors ----------

/** The content of a plan stage proposal, typed by its key. Uses the leader's version when adjusted. */
export function stageContent<K extends StageKey>(proposal: Proposal, key: K): StageOutputs[K] {
  const content = proposal.status === 'adjusted' && proposal.adjusted_content ? proposal.adjusted_content : proposal.content
  if (proposal.kind !== 'plan_stage' || proposal.key !== key) throw new Error(`Proposal ${proposal.id} isn't the ${key} stage`)
  return content as unknown as StageOutputs[K]
}
