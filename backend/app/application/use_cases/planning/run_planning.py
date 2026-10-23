"""Runs the plan stages in order and emits each agent's progress.

For now it chains every stage without pausing (pre-migration behavior).
The pause to approve each stage as a Proposal comes with spec 002
(StartPlanning + RunPlanningStep)."""

from collections.abc import AsyncIterator
from typing import Any

from app.application.ports.agents import PlanningAgents
from app.domain.events import AgentFinished, AgentStarted, DomainEvent
from app.domain.plan import PLANNING_STAGES
from app.domain.project import Project


def _project_context(project: Project) -> dict[str, Any]:
    """What the agents see of the project: input data, no ids or status."""
    data = project.model_dump(
        mode="json", include={"name", "description", "duration_weeks", "requested_methodology"}
    )
    data["members"] = [
        m.model_dump(mode="json", include={"name", "role", "seniority", "hours_per_week", "skills"})
        for m in project.members
    ]
    return data


class RunPlanning:
    def __init__(self, agents: PlanningAgents):
        self._agents = agents

    async def __call__(self, project: Project) -> AsyncIterator[DomainEvent]:
        results: dict[str, Any] = {"project": _project_context(project)}
        for stage in PLANNING_STAGES:
            yield AgentStarted(project_id=project.id, agent=stage.key, title=stage.title)
            context = {key: results.get(key) for key in stage.inputs}
            output = (await self._agents.run_stage(stage, context)).model_dump(mode="json")
            results[stage.key] = output
            yield AgentFinished(project_id=project.id, agent=stage.key, title=stage.title, output=output)
