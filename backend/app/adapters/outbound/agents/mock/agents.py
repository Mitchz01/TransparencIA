import asyncio
from typing import Any

from pydantic import BaseModel

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.plan import PlanningStage


class MockPlanningAgents:
    """Devuelve el plan de ejemplo con una demora, para desarrollar el front sin API key."""

    def __init__(self, delay_seconds: float = 0.8):
        self._delay = delay_seconds

    async def run_stage(self, stage: PlanningStage, context: dict[str, Any]) -> BaseModel:
        await asyncio.sleep(self._delay)
        return stage.schema.model_validate(MOCK_PLAN[stage.key])
