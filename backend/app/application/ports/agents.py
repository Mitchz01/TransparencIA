from typing import Any, Protocol

from pydantic import BaseModel

from app.domain.plan import PlanningStage


class PlanningAgents(Protocol):
    """Corre el agente de una etapa del plan. El orden de las etapas y la aprobación
    entre una y otra los decide el caso de uso, no el adaptador."""

    async def run_stage(self, stage: PlanningStage, context: dict[str, Any]) -> BaseModel:
        """`context` trae sólo las claves de `stage.inputs`; devuelve una instancia de `stage.schema`."""
        ...
