"""Domain events. They're published on the EventBus and the HTTP adapter streams them over SSE."""

from typing import Any, Literal

from pydantic import BaseModel


class DomainEvent(BaseModel):
    type: str
    project_id: int | None = None


class AgentStarted(DomainEvent):
    type: Literal["agent_started"] = "agent_started"
    agent: str
    title: str


class AgentFinished(DomainEvent):
    type: Literal["agent_finished"] = "agent_finished"
    agent: str
    title: str
    output: dict[str, Any]


class PlanFailed(DomainEvent):
    type: Literal["plan_failed"] = "plan_failed"
    agent: str
    error: str


class ProposalCreated(DomainEvent):
    type: Literal["proposal_created"] = "proposal_created"
    proposal_id: int


class ProposalResolved(DomainEvent):
    type: Literal["proposal_resolved"] = "proposal_resolved"
    proposal_id: int
    status: str


class TaskStatusChanged(DomainEvent):
    type: Literal["task_status_changed"] = "task_status_changed"
    task_id: int
    status: str
