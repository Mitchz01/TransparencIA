"""Corre las etapas del plan en orden y emite el progreso de cada agente.

Por ahora encadena todas las etapas sin pausa (comportamiento previo a la migración).
La pausa para aprobar cada etapa como Proposal llega con la spec 005."""

from collections.abc import AsyncIterator
from typing import Any

from app.application.ports.agents import PlanningAgents
from app.domain.events import AgentFinished, AgentStarted, DomainEvent
from app.domain.plan import PLANNING_STAGES
from app.domain.project import Project


def _project_context(project: Project) -> dict[str, Any]:
    """Lo que ven los agentes del proyecto: datos de entrada, sin ids ni estado."""
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
