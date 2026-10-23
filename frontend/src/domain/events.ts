// Espejo de backend/app/domain/events.py

interface BaseEvent {
  project_id: number | null
}

export interface AgentStarted extends BaseEvent {
  type: 'agent_started'
  agent: string
  title: string
}

export interface AgentFinished extends BaseEvent {
  type: 'agent_finished'
  agent: string
  title: string
  output: Record<string, unknown>
}

export interface PlanFailed extends BaseEvent {
  type: 'plan_failed'
  agent: string
  error: string
}

export interface ProposalCreated extends BaseEvent {
  type: 'proposal_created'
  proposal_id: number
}

export interface ProposalResolved extends BaseEvent {
  type: 'proposal_resolved'
  proposal_id: number
  status: string
}

export interface TaskStatusChanged extends BaseEvent {
  type: 'task_status_changed'
  task_id: number
  status: string
}

export type DomainEvent =
  | AgentStarted
  | AgentFinished
  | PlanFailed
  | ProposalCreated
  | ProposalResolved
  | TaskStatusChanged
