"""Spec 017 with Google ADK + Gemini (P2): one LlmAgent per call with output_schema; the evidence
file travels in the user message as bytes. Both calls read or explain — they never compute a number;
the traffic light and the percentages stay in domain/transparency.py (P1)."""

import json
from typing import Any, get_args, get_origin

from google.adk.agents import LlmAgent
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from app.adapters.outbound.agents.adk.transparency_prompts import ANSWER_CITIZEN, READ_EVIDENCE
from app.domain.transparency import AgentUnavailable, CitizenAnswer, EvidenceReading

APP_NAME = "agile-planner-transparency"
USER_ID = "auditor"

# Low temperature: this is structured extraction and factual answering, not creative writing, and the
# restaurant invoice must be flagged every time (spec 017, SC-004).
_CONFIG = types.GenerateContentConfig(temperature=0.1)


def _instruction(prompt: str, context: dict[str, Any]):
    # A provider instead of an f-string in `instruction`: ADK doesn't try to replace the JSON braces.
    def provider(_: ReadonlyContext) -> str:
        return f"{prompt}\n\nContext (JSON):\n{json.dumps(context, ensure_ascii=False, indent=2, default=str)}"

    return provider


def _fill_absent(output: Any, schema: type[BaseModel]) -> Any:
    """Gemini often drops a field instead of sending it as null, but every field of the domain's
    schemas is required (they have no defaults, so an absent key fails validation). An absent
    nullable field means null; an absent list means empty. Driven by the schema, so it keeps
    working if domain/transparency.py gains or loses a field."""
    if not isinstance(output, dict):
        return output
    filled = dict(output)
    for name, field in schema.model_fields.items():
        if name in filled:
            continue
        if type(None) in get_args(field.annotation):
            filled[name] = None
        elif get_origin(field.annotation) is list:
            filled[name] = []
    return filled


async def _run(name: str, model: str, instruction, output_schema: type[BaseModel], message: types.Content) -> Any:
    """Runs one agent to completion and returns its raw structured output (or None if it produced none)."""
    agent = LlmAgent(
        name=name,
        model=model,
        instruction=instruction,
        output_schema=output_schema,
        output_key=name,
        generate_content_config=_CONFIG,
    )
    session_service = InMemorySessionService()
    runner = Runner(app_name=APP_NAME, agent=agent, session_service=session_service)
    session = await session_service.create_session(app_name=APP_NAME, user_id=USER_ID)

    output: Any = None
    async for event in runner.run_async(user_id=USER_ID, session_id=session.id, new_message=message):
        delta = event.actions.state_delta if event.actions else {}
        output = delta.get(name, output)
    return output


class AdkTransparencyAgents:
    def __init__(self, model: str):
        self._model = model

    async def read_evidence(self, context: dict[str, Any], file: bytes, mime: str, filename: str) -> EvidenceReading:
        message = types.Content(
            role="user",
            parts=[
                types.Part(text=f"Read this evidence. File name: {filename}"),
                types.Part.from_bytes(data=file, mime_type=mime),
            ],
        )
        try:
            output = await _run("read_evidence", self._model, _instruction(READ_EVIDENCE, context), EvidenceReading, message)
            if output is None:
                raise AgentUnavailable()
            return EvidenceReading.model_validate(_fill_absent(output, EvidenceReading))
        except AgentUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001 — any agent failure (crash, bad JSON, bad schema) becomes AgentUnavailable
            raise AgentUnavailable() from exc

    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer:
        message = types.Content(role="user", parts=[types.Part(text=question)])
        try:
            output = await _run("answer_citizen", self._model, _instruction(ANSWER_CITIZEN, portal), CitizenAnswer, message)
            if output is None:
                raise AgentUnavailable()
            return CitizenAnswer.model_validate(_fill_absent(output, CitizenAnswer))
        except AgentUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001 — any agent failure (crash, bad JSON, bad schema) becomes AgentUnavailable
            raise AgentUnavailable() from exc
