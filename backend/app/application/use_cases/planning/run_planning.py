"""Corre las etapas del plan en orden y emite el progreso de cada agente.

Por ahora encadena todas las etapas sin pausa (comportamiento previo a la migración).
La pausa para aprobar cada etapa como Proposal llega con la spec 005."""

from collections.abc import AsyncIterator
from typing import Any

from app.application.ports.agents import PlanningAgents
from app.domain.events import AgentFinished, AgentStarted, DomainEvent
from app.domain.plan import PLANNING_STAGES


class RunPlanning:
    def __init__(self, agents: PlanningAgents):
        self._agents = agents

    async def __call__(self, project: dict[str, Any], project_id: int | None = None) -> AsyncIterator[DomainEvent]:
        results: dict[str, Any] = {"project": project}
        for stage in PLANNING_STAGES:
            yield AgentStarted(project_id=project_id, agent=stage.key, title=stage.title)
            context = {key: results.get(key) for key in stage.inputs}
            output = (await self._agents.run_stage(stage, context)).model_dump()
            results[stage.key] = output
            yield AgentFinished(project_id=project_id, agent=stage.key, title=stage.title, output=output)
