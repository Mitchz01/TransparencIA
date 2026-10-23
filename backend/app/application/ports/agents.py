from typing import Any, Protocol

from pydantic import BaseModel

from app.domain.plan import PlanningStage


class PlanningAgents(Protocol):
    """Runs the agent of one plan stage. The order of the stages and the approval
    between them are decided by the use case, not the adapter."""

    async def run_stage(self, stage: PlanningStage, context: dict[str, Any]) -> BaseModel:
        """`context` only carries the keys in `stage.inputs`; returns an instance of `stage.schema`."""
        ...
