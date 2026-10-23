"""Agents with Google ADK + Gemini.

Each stage is an LlmAgent with output_schema that runs in its own session:
the context (what was approved in previous stages) comes in as a parameter,
so the use case can pause between stages for the user to approve.
"""

import json
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from app.adapters.outbound.agents.adk.prompts import COMMON, PROMPTS
from app.domain.plan import PlanningStage

APP_NAME = "agile-planner"
USER_ID = "planner"


def _instruction(stage: PlanningStage, context: dict[str, Any]):
    # A provider instead of a string: ADK doesn't try to replace the JSON braces as variables.
    def provider(_: ReadonlyContext) -> str:
        return (
            f"{COMMON}\n\nYour role: {stage.title}.\n{PROMPTS[stage.key]}\n\n"
            f"Context (JSON):\n{json.dumps(context, ensure_ascii=False, indent=2, default=str)}"
        )

    return provider


class AdkPlanningAgents:
    def __init__(self, model: str):
        self._model = model

    async def run_stage(self, stage: PlanningStage, context: dict[str, Any]) -> BaseModel:
        agent = LlmAgent(
            name=stage.key,
            model=self._model,
            description=stage.title,
            instruction=_instruction(stage, context),
            output_schema=stage.schema,
            output_key=stage.key,
        )
        session_service = InMemorySessionService()
        runner = Runner(app_name=APP_NAME, agent=agent, session_service=session_service)
        session = await session_service.create_session(app_name=APP_NAME, user_id=USER_ID)
        message = types.Content(role="user", parts=[types.Part(text="Generate your part of the plan.")])

        output: Any = None
        async for event in runner.run_async(user_id=USER_ID, session_id=session.id, new_message=message):
            delta = event.actions.state_delta if event.actions else {}
            output = delta.get(stage.key, output)

        if output is None:
            raise RuntimeError(f"Agent {stage.key} returned no result")
        return stage.schema.model_validate(output)
