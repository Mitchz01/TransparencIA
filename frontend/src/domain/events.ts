// Mirrors backend/app/domain/events.py. Every event carries the common fields of
// BaseEvent (spec 005); `type` selects the rest. Unknown types must be ignored.

import type { TaskStatus } from './board'
import type { ProposalKind, ProposalStatus } from './proposals'

export type Actor = 'agent' | 'person' | 'github' | 'system'

export interface BaseEvent {
  seq: number // increasing; use the highest one you've seen as `after`
  project_id: number
  occurred_at: string
  actor: Actor
  summary: string // one line, ready to show in the activity feed
  ref: { kind: string; id: number } | null // what the event is about, to link it
}

export type DomainEvent = BaseEvent &
  (
    // spec 002: planning
    | { type: 'agent_started'; agent: string; title: string }
    | { type: 'agent_finished'; agent: string; title: string; output: Record<string, unknown> }
    | { type: 'proposal_created'; proposal_id: number; kind: ProposalKind; key: string; agent: string }
    | { type: 'proposal_resolved'; proposal_id: number; kind: ProposalKind; key: string; status: ProposalStatus; auto: boolean; reason: string | null }
    // spec 005: proposals and stream
    | { type: 'proposal_apply_failed'; proposal_id: number; error: string }
    | { type: 'resync' }
    | { type: 'stage_needs_leader'; stage: string; rejections: number }
    | { type: 'plan_failed'; agent: string; error: string }
    | { type: 'plan_completed' }
    // spec 001: team
    | { type: 'team_changed'; joined: string[]; left: string[]; changed: { member_id: number; name: string; fields: string[] }[] }
    // spec 003: board
    | { type: 'plan_applied'; skipped_story_keys: string[] }
    | { type: 'task_status_changed'; task_id: number; status: TaskStatus }
    | { type: 'task_updated'; task_id: number }
    | { type: 'task_created'; task_id: number; key: string; status: TaskStatus; sprint_id: number | null } // spec 014
    // spec 006: documents
    | { type: 'documents_generated'; missing: string[] }
    // spec 007: GitHub
    | { type: 'issues_published'; proposal_id: number; created: { task_id: number; number: number }[]; failed: { task_id: number; error: string }[] }
    // spec 008: sync and replanning
    | { type: 'objective_closed'; objective_id: number }
    | { type: 'sprint_closed'; sprint_id: number; pending_task_keys: string[] }
    | { type: 'replan_applied'; applied: string[]; discarded: { task_key: string; reason: string }[] }
    | { type: 'github_event_ignored'; reason: string }
  )

export type DomainEventType = DomainEvent['type']

export const EVENT_TYPES: readonly DomainEventType[] = [
  'agent_started', 'agent_finished', 'proposal_created', 'proposal_resolved', 'proposal_apply_failed', 'resync',
  'stage_needs_leader', 'plan_failed', 'plan_completed', 'team_changed', 'plan_applied', 'task_status_changed',
  'task_updated', 'task_created', 'documents_generated', 'issues_published', 'objective_closed', 'sprint_closed', 'replan_applied',
  'github_event_ignored',
]
