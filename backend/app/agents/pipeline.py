"""Pipeline multi-agente con Google ADK.

Cada paso es un LlmAgent con output_schema: lee del state lo que dejaron los
anteriores y guarda su resultado en `output_key`. Un SequentialAgent los
encadena y `run_pipeline` emite eventos de progreso para el front (SSE).
"""

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from app.agents import schemas
from app.config import GEMINI_MODEL, MOCK_AGENTS

APP_NAME = "agile-planner"

COMMON = (
    "Sos parte de un equipo de agentes que planifica proyectos de software. "
    "Respondé en el mismo idioma que la descripción del proyecto. "
    "Sé concreto y realista con el tamaño y la experiencia del equipo."
)


@dataclass(frozen=True)
class Step:
    key: str  # output_key en el state
    title: str  # nombre que ve el usuario
    schema: type[BaseModel]
    inputs: tuple[str, ...]
    prompt: str


STEPS: tuple[Step, ...] = (
    Step(
        key="analysis",
        title="Analista de producto",
        schema=schemas.Analysis,
        inputs=("project",),
        prompt=(
            "Analizá el proyecto: objetivos, alcance (qué entra y qué no), riesgos con "
            "mitigación, complejidad y qué roles o skills le faltan al equipo."
        ),
    ),
    Step(
        key="methodology",
        title="Agile coach",
        schema=schemas.MethodologyDecision,
        inputs=("project", "analysis"),
        prompt=(
            "Elegí la metodología ágil. Si `requested_methodology` es distinto de 'auto', "
            "usá esa y explicá cómo adaptarla a este equipo; si es 'auto', elegí la mejor "
            "según tamaño del equipo, incertidumbre y plazo, y justificá por qué descartaste "
            "las alternativas. Definí ceremonias, duración de iteración y límites WIP."
        ),
    ),
    Step(
        key="architecture",
        title="Arquitecto de software",
        schema=schemas.Architecture,
        inputs=("project", "analysis", "methodology"),
        prompt=(
            "Proponé la arquitectura: estilo, componentes, stack por capa y decisiones "
            "clave (tipo ADR). Priorizá tecnologías que el equipo ya conoce según sus skills."
        ),
    ),
    Step(
        key="roadmap",
        title="Product manager",
        schema=schemas.Roadmap,
        inputs=("project", "analysis", "methodology", "architecture"),
        prompt=(
            "Armá el roadmap por fases (ej: descubrimiento, MVP, beta, lanzamiento) que "
            "entre en `duration_weeks`. Cada fase tiene objetivo, semanas, entregables y "
            "épicas con key única (EP-1, EP-2, ...)."
        ),
    ),
    Step(
        key="backlog",
        title="Product owner",
        schema=schemas.Backlog,
        inputs=("project", "architecture", "roadmap"),
        prompt=(
            "Descomponé cada épica en historias de usuario (US-1, US-2, ...) con criterios "
            "de aceptación, tipo, story points en Fibonacci, prioridad y el rol del equipo "
            "más adecuado. Entre 3 y 6 historias por épica."
        ),
    ),
    Step(
        key="sprints",
        title="Scrum master",
        schema=schemas.SprintPlanning,
        inputs=("project", "methodology", "roadmap", "backlog"),
        prompt=(
            "Repartí las historias en iteraciones de `sprint_length_weeks` respetando el "
            "orden de las fases y la capacidad del equipo (hours_per_week y seniority). "
            "Asigná cada historia a un miembro cuyo rol encaje, usando su `name` exacto. "
            "Toda historia del backlog debe quedar en exactamente una iteración."
        ),
    ),
)


def _instruction(step: Step):
    def provider(ctx: ReadonlyContext) -> str:
        context = {key: ctx.state.get(key) for key in step.inputs}
        return (
            f"{COMMON}\n\nTu rol: {step.title}.\n{step.prompt}\n\n"
            f"Contexto (JSON):\n{json.dumps(context, ensure_ascii=False, indent=2)}"
        )

    return provider


def build_pipeline() -> SequentialAgent:
    return SequentialAgent(
        name="planning_pipeline",
        sub_agents=[
            LlmAgent(
                name=step.key,
                model=GEMINI_MODEL,
                description=step.title,
                instruction=_instruction(step),
                output_schema=step.schema,
                output_key=step.key,
            )
            for step in STEPS
        ],
    )


def _started(i: int) -> dict[str, Any]:
    return {"type": "agent_started", "agent": STEPS[i].key, "title": STEPS[i].title}


def _finished(i: int, output: Any) -> dict[str, Any]:
    return {"type": "agent_finished", "agent": STEPS[i].key, "title": STEPS[i].title, "output": output}


async def run_pipeline(project: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
    """Corre los agentes y va emitiendo agent_started / agent_finished."""
    if MOCK_AGENTS:
        async for event in _run_mock():
            yield event
        return

    session_service = InMemorySessionService()
    runner = Runner(app_name=APP_NAME, agent=build_pipeline(), session_service=session_service)
    session = await session_service.create_session(
        app_name=APP_NAME, user_id="planner", state={"project": project}
    )
    message = types.Content(role="user", parts=[types.Part(text="Generá el plan del proyecto.")])
    index_by_key = {step.key: i for i, step in enumerate(STEPS)}

    yield _started(0)
    async for event in runner.run_async(user_id="planner", session_id=session.id, new_message=message):
        delta = event.actions.state_delta if event.actions else {}
        for key, output in delta.items():
            if key not in index_by_key:
                continue
            i = index_by_key[key]
            yield _finished(i, output)
            if i + 1 < len(STEPS):
                yield _started(i + 1)


async def _run_mock() -> AsyncIterator[dict[str, Any]]:
    from app.agents.mock import MOCK_PLAN

    for i, step in enumerate(STEPS):
        yield _started(i)
        await asyncio.sleep(0.8)
        yield _finished(i, MOCK_PLAN[step.key])
